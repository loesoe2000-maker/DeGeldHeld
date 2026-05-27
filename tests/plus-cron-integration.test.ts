/**
 * tests/plus-cron-integration.test.ts — v34 ASSURANCE DEEL 4.
 *
 * Roept de Plus-rescan cron-route (GET /api/cron/plus-rescan) aan met
 * gemockte Prisma + gemockte Resend en valideert:
 *
 *   (a) 401 zonder CRON_SECRET-bearer (auth-gate)
 *   (b) 503 met PLUS_RESCAN_CRON_ENABLED uit (flag-gate)
 *   (c) Happy-path: 1 ACTIVE Plus-user → PlusRescan-row aangemaakt
 *       (findingsJson niet leeg) + sendEmail aangeroepen
 *   (d) Auth-gate accepteert ook `x-vercel-cron`-header (platform-trigger)
 *
 * Doel: Plus-cron-zekerheid 50% → 80%. Mocks zijn essentieel — we hitten
 * GEEN echte Neon-DB en versturen GEEN echte mail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const billFindMany = vi.fn();
const userFindMany = vi.fn();
const box3FindMany = vi.fn();
// v36 — Plus-cron dekt nu ook V35-claim-hub (huurcommissie + energie-claim).
const huurFindMany = vi.fn();
const energieFindMany = vi.fn();
const rescanFindFirst = vi.fn();
const rescanCreate = vi.fn();
const rescanUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    bill: { findMany: (args: unknown) => billFindMany(args) },
    user: { findMany: (args: unknown) => userFindMany(args) },
    box3Claim: { findMany: (args: unknown) => box3FindMany(args) },
    huurServicekostenClaim: { findMany: (args: unknown) => huurFindMany(args) },
    energieEindafrekeningClaim: { findMany: (args: unknown) => energieFindMany(args) },
    plusRescan: {
      findFirst: (args: unknown) => rescanFindFirst(args),
      create: (args: unknown) => rescanCreate(args),
      updateMany: (args: unknown) => rescanUpdateMany(args),
    },
  },
}));

const isEnabledMock = vi.fn();
vi.mock("@/lib/feature-flags", () => ({ isEnabled: (k: string) => isEnabledMock(k) }));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({ sendEmail: (opts: unknown) => sendEmailMock(opts) }));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// Vóór de route-import zodat cron-auth env-stable is in test-context.
// NODE_ENV blijft op vitest-default — cron-auth treedt alleen fail-closed
// in productie; in test/dev mag de auth check anders evalueren maar wij
// passen sowieso een geldige Bearer mee zodat alle tests deterministisch zijn.
process.env.CRON_SECRET = "test-cron-secret-v34";

import { GET } from "@/app/api/cron/plus-rescan/route";

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/plus-rescan", { headers });
}

describe("/api/cron/plus-rescan — gating", () => {
  beforeEach(() => {
    billFindMany.mockReset();
    userFindMany.mockReset();
    box3FindMany.mockReset();
    huurFindMany.mockReset();
    energieFindMany.mockReset();
    rescanFindFirst.mockReset();
    rescanCreate.mockReset();
    rescanUpdateMany.mockReset();
    isEnabledMock.mockReset();
    sendEmailMock.mockReset();
    // v36 — defaults zodat tests die alleen Box 3 / spook valideren niet
    // crashen op undefined uit huur/energie-mocks.
    huurFindMany.mockResolvedValue([]);
    energieFindMany.mockResolvedValue([]);
    box3FindMany.mockResolvedValue([]);
    billFindMany.mockResolvedValue([]);
  });

  it("(a) 401 zonder Bearer-secret", async () => {
    isEnabledMock.mockReturnValue(true);
    const r = await GET(makeReq());
    expect(r.status).toBe(401);
    const body = await r.json();
    expect(body.error).toBe("Unauthorized");
    // Prisma mag NIET zijn aangeroepen — fail-closed gate.
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("(a) 401 met verkeerde Bearer-token", async () => {
    isEnabledMock.mockReturnValue(true);
    const r = await GET(makeReq({ authorization: "Bearer wrong-secret" }));
    expect(r.status).toBe(401);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("(b) 503 met PLUS_RESCAN_CRON_ENABLED uit", async () => {
    isEnabledMock.mockReturnValue(false);
    const r = await GET(makeReq({ authorization: "Bearer test-cron-secret-v34" }));
    expect(r.status).toBe(503);
    const body = await r.json();
    expect(body.error).toBe("feature disabled");
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("(d) Auth accepteert x-vercel-cron-header (platform-trigger)", async () => {
    isEnabledMock.mockReturnValue(true);
    userFindMany.mockResolvedValue([]); // geen users → klaar
    const r = await GET(makeReq({ "x-vercel-cron": "1" }));
    expect(r.status).toBe(200);
    expect(userFindMany).toHaveBeenCalled();
  });
});

describe("/api/cron/plus-rescan — happy-path: 1 ACTIVE Plus-user → rescan + mail", () => {
  beforeEach(() => {
    billFindMany.mockReset();
    userFindMany.mockReset();
    box3FindMany.mockReset();
    huurFindMany.mockReset();
    energieFindMany.mockReset();
    rescanFindFirst.mockReset();
    rescanCreate.mockReset();
    rescanUpdateMany.mockReset();
    isEnabledMock.mockReset();
    sendEmailMock.mockReset();
    // v36 — defaults zodat tests die alleen Box 3 / spook valideren niet
    // crashen op undefined uit huur/energie-mocks.
    huurFindMany.mockResolvedValue([]);
    energieFindMany.mockResolvedValue([]);
    box3FindMany.mockResolvedValue([]);
    billFindMany.mockResolvedValue([]);

    isEnabledMock.mockReturnValue(true);
  });

  it("PlusRescan-row aangemaakt + findingsJson niet leeg + sendEmail gedispatched", async () => {
    userFindMany.mockResolvedValue([
      { id: "u_test_1", email: "plus@example.test" },
    ]);

    // Eerste run voor deze user → géén vorige rescan-snapshot.
    rescanFindFirst.mockResolvedValue(null);

    // Bills: 2 STREAMING-abonnementen → category-duplicate finding.
    billFindMany.mockResolvedValue([
      { id: "b1", provider: "Netflix", category: "STREAMING", monthlyCents: 1599, amountCents: 1599 },
      { id: "b2", provider: "Disney+", category: "STREAMING", monthlyCents: 1099, amountCents: 1099 },
    ]);

    // 1 open Box3-claim → 'box3'-finding zonder maandbedrag.
    box3FindMany.mockResolvedValue([
      { id: "c1", jaar: 2023, verwachteTeruggaveCents: 80_000, status: "AWAITING_PROOF" },
    ]);

    rescanCreate.mockResolvedValue({ id: "rescan-1" });
    rescanUpdateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({ id: "mail-1", skipped: false });

    const r = await GET(makeReq({ authorization: "Bearer test-cron-secret-v34" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ scanned: 1, notified: 1, errors: 0 });

    // Prisma create kwam met findingsJson dat NIET leeg is.
    expect(rescanCreate).toHaveBeenCalledTimes(1);
    const createCall = rescanCreate.mock.calls[0][0] as {
      data: { userId: string; findingsJson: { snapshot: unknown[]; delta: unknown } };
    };
    expect(createCall.data.userId).toBe("u_test_1");
    expect(Array.isArray(createCall.data.findingsJson.snapshot)).toBe(true);
    expect(createCall.data.findingsJson.snapshot.length).toBeGreaterThan(0);

    // Mail-payload: subject + text aanwezig + ge-call'd op het juiste adres.
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const mailCall = sendEmailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(mailCall.to).toBe("plus@example.test");
    expect(mailCall.subject).toMatch(/Plus.*scan|update/i);
    expect(mailCall.text).toMatch(/Nieuw deze maand|Box 3/);

    // notifiedAt is gestempeld.
    expect(rescanUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("0 ACTIVE users → 200 met scanned=0, notified=0, géén mail", async () => {
    userFindMany.mockResolvedValue([]);
    const r = await GET(makeReq({ authorization: "Bearer test-cron-secret-v34" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ scanned: 0, notified: 0, errors: 0 });
    expect(billFindMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(rescanCreate).not.toHaveBeenCalled();
  });

  it("user zonder findings én zonder vorige snapshot → géén mail (lege delta)", async () => {
    userFindMany.mockResolvedValue([
      { id: "u_empty", email: "empty@example.test" },
    ]);
    rescanFindFirst.mockResolvedValue(null);
    billFindMany.mockResolvedValue([]); // geen bills
    box3FindMany.mockResolvedValue([]); // geen open claims
    rescanCreate.mockResolvedValue({ id: "rescan-empty" });

    const r = await GET(makeReq({ authorization: "Bearer test-cron-secret-v34" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ scanned: 1, notified: 0, errors: 0 });

    // Snapshot wordt nog steeds gepersisteerd (volgende run kan diff'en),
    // maar er gaat geen mail uit.
    expect(rescanCreate).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("mail-faal verhoogt errors-counter zonder de hele run te killen", async () => {
    userFindMany.mockResolvedValue([
      { id: "u_mail_fail", email: "fail@example.test" },
    ]);
    rescanFindFirst.mockResolvedValue(null);
    billFindMany.mockResolvedValue([
      { id: "b1", provider: "Netflix", category: "STREAMING", monthlyCents: 1599, amountCents: 1599 },
      { id: "b2", provider: "Disney+", category: "STREAMING", monthlyCents: 1099, amountCents: 1099 },
    ]);
    box3FindMany.mockResolvedValue([]);
    rescanCreate.mockResolvedValue({ id: "rescan-x" });
    sendEmailMock.mockRejectedValue(new Error("resend rate-limited"));

    const r = await GET(makeReq({ authorization: "Bearer test-cron-secret-v34" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.scanned).toBe(1);
    expect(body.notified).toBe(0);
    expect(body.errors).toBe(1); // mail-fail registered
  });
});
