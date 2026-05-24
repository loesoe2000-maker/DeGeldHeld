import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  diffFindings,
  formatRescanFindings,
  isEmptyDelta,
  runRescanForUser,
  type RescanFinding,
} from "@/lib/plus-rescan";

/**
 * v30 DEEL 2 — Plus maandelijkse her-scan engine.
 * Pure helpers + cron-route (auth + flag + per-user iteratie).
 */

const F = (over: Partial<RescanFinding>): RescanFinding => ({
  kind: "spookabonnement",
  id: "x",
  label: "x",
  maandIndicatieCents: null,
  ...over,
});

describe("diffFindings", () => {
  it("lege previous + lege current → lege delta", () => {
    expect(isEmptyDelta(diffFindings([], []))).toBe(true);
  });
  it("nieuwe finding → 'nieuw'", () => {
    const d = diffFindings([], [F({ id: "a", label: "Netflix dubbel" })]);
    expect(d.nieuw).toHaveLength(1);
    expect(d.gewijzigd).toHaveLength(0);
    expect(d.verdwenen).toHaveLength(0);
  });
  it("identieke finding → niet in delta", () => {
    const prev = [F({ id: "a", label: "Netflix dubbel", maandIndicatieCents: 1495 })];
    const curr = [F({ id: "a", label: "Netflix dubbel", maandIndicatieCents: 1495 })];
    expect(isEmptyDelta(diffFindings(prev, curr))).toBe(true);
  });
  it("zelfde id maar bedrag wijzigt → 'gewijzigd'", () => {
    const prev = [F({ id: "a", maandIndicatieCents: 1000 })];
    const curr = [F({ id: "a", maandIndicatieCents: 2000 })];
    const d = diffFindings(prev, curr);
    expect(d.gewijzigd).toHaveLength(1);
    expect(d.nieuw).toHaveLength(0);
  });
  it("zelfde id maar label wijzigt → 'gewijzigd'", () => {
    const prev = [F({ id: "a", label: "Oud" })];
    const curr = [F({ id: "a", label: "Nieuw" })];
    expect(diffFindings(prev, curr).gewijzigd).toHaveLength(1);
  });
  it("finding verdwenen → 'verdwenen'", () => {
    const prev = [F({ id: "a" })];
    const curr: RescanFinding[] = [];
    const d = diffFindings(prev, curr);
    expect(d.verdwenen).toHaveLength(1);
  });
});

describe("runRescanForUser", () => {
  it("geen veranderingen → shouldNotify=false + geen mail", () => {
    const r = runRescanForUser({
      userId: "u1",
      previousFindings: [F({ id: "a" })],
      currentFindings: [F({ id: "a" })],
    });
    expect(r.shouldNotify).toBe(false);
    expect(r.mail).toBeUndefined();
  });
  it("nieuwe vondst → shouldNotify=true + mail-subject noemt aantal", () => {
    const r = runRescanForUser({
      userId: "u1",
      previousFindings: [],
      currentFindings: [
        F({ id: "a", label: "Netflix dubbel", maandIndicatieCents: 1495 }),
        F({ id: "b", label: "Spotify family overlap", maandIndicatieCents: 1099 }),
      ],
    });
    expect(r.shouldNotify).toBe(true);
    expect(r.mail?.subject).toMatch(/2 updates/);
    expect(r.mail?.text).toMatch(/Netflix dubbel/);
    expect(r.mail?.text).toMatch(/€ 14,95\/mnd|€ 14,95/);
  });
  it("alleen verdwenen → wel notificeren", () => {
    const r = runRescanForUser({
      userId: "u1",
      previousFindings: [F({ id: "a", label: "Oud item" })],
      currentFindings: [],
    });
    expect(r.shouldNotify).toBe(true);
    expect(r.mail?.text).toMatch(/Niet meer van toepassing/);
  });
});

describe("formatRescanFindings", () => {
  it("zonder maand-indicatie laat geen € zien", () => {
    const { text } = formatRescanFindings({
      nieuw: [F({ id: "a", label: "Open Box 3-claim 2023", maandIndicatieCents: null })],
      gewijzigd: [],
      verdwenen: [],
    });
    expect(text).toMatch(/Open Box 3-claim 2023/);
    expect(text).not.toMatch(/€/); // geen bedrag verzonnen als 't er niet is
  });
});

// ─── /api/cron/plus-rescan ──────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  flagOn: true,
  cronSecret: "test-cron-secret",
  users: [] as Array<{ id: string; email: string | null }>,
  bills: [] as Array<{ id: string; provider: string; category: string; monthlyCents: number | null; amountCents: number }>,
  box3Claims: [] as Array<{ id: string; jaar: number; verwachteTeruggaveCents: number; status: string }>,
  prevSnapshot: [] as RescanFinding[],
  rescansCreated: [] as Array<{ userId: string; findingsJson: unknown }>,
  notifiedUpdates: 0,
  mailsSent: [] as Array<{ to: string; subject: string }>,
}));

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => h.flagOn }));
vi.mock("@/lib/cron-auth", () => ({
  authorizeCron: (req: Request) => {
    const auth = req.headers.get("authorization") ?? "";
    return auth === `Bearer ${h.cronSecret}`;
  },
  logCronEvent: () => {},
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async () => h.users),
    },
    bill: {
      findMany: vi.fn(async () => h.bills),
    },
    box3Claim: {
      findMany: vi.fn(async () => h.box3Claims),
    },
    plusRescan: {
      findFirst: vi.fn(async () =>
        h.prevSnapshot.length > 0
          ? { findingsJson: { snapshot: h.prevSnapshot } }
          : null,
      ),
      create: vi.fn(async (a: { data: { userId: string; findingsJson: unknown } }) => {
        h.rescansCreated.push(a.data);
        return { id: "rescan_" + h.rescansCreated.length };
      }),
      updateMany: vi.fn(async () => {
        h.notifiedUpdates++;
        return { count: 1 };
      }),
    },
  },
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (o: { to: string; subject: string }) => {
    h.mailsSent.push({ to: o.to, subject: o.subject });
    return { id: "x", skipped: false };
  }),
  escapeHtml: (s: string) => s,
}));

import { GET as cronGET } from "@/app/api/cron/plus-rescan/route";

function cronReq(headers: Record<string, string> = {}) {
  return new Request("https://t/api/cron/plus-rescan", {
    method: "GET",
    headers,
  }) as unknown as Parameters<typeof cronGET>[0];
}

beforeEach(() => {
  h.flagOn = true;
  h.users = [];
  h.bills = [];
  h.box3Claims = [];
  h.prevSnapshot = [];
  h.rescansCreated = [];
  h.notifiedUpdates = 0;
  h.mailsSent = [];
});

describe("GET /api/cron/plus-rescan", () => {
  it("401 zonder Authorization header", async () => {
    const r = await cronGET(cronReq());
    expect(r.status).toBe(401);
  });

  it("401 met verkeerd secret", async () => {
    const r = await cronGET(cronReq({ authorization: "Bearer wrong" }));
    expect(r.status).toBe(401);
  });

  it("503 wanneer flag uit (maar secret geldig)", async () => {
    h.flagOn = false;
    const r = await cronGET(cronReq({ authorization: `Bearer ${h.cronSecret}` }));
    expect(r.status).toBe(503);
  });

  it("0 actieve users → scanned=0, notified=0", async () => {
    const r = await cronGET(cronReq({ authorization: `Bearer ${h.cronSecret}` }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ scanned: 0, notified: 0, errors: 0 });
  });

  it("active user met spookabonnement → nieuwe finding → mail + PlusRescan record", async () => {
    h.users = [{ id: "u1", email: "anne@x.nl" }];
    h.bills = [
      { id: "b1", provider: "Netflix", category: "STREAMING", monthlyCents: 1495, amountCents: 1495 },
      { id: "b2", provider: "Netflix", category: "STREAMING", monthlyCents: 1495, amountCents: 1495 },
    ];
    const r = await cronGET(cronReq({ authorization: `Bearer ${h.cronSecret}` }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.scanned).toBe(1);
    expect(json.notified).toBe(1);
    expect(json.errors).toBe(0);
    expect(h.rescansCreated).toHaveLength(1);
    expect(h.mailsSent[0]?.to).toBe("anne@x.nl");
    expect(h.notifiedUpdates).toBe(1);
  });

  it("active user maar zelfde findings als vorige run → geen mail (lege delta)", async () => {
    h.users = [{ id: "u1", email: "anne@x.nl" }];
    h.bills = [
      { id: "b1", provider: "Netflix", category: "STREAMING", monthlyCents: 1495, amountCents: 1495 },
      { id: "b2", provider: "Netflix", category: "STREAMING", monthlyCents: 1495, amountCents: 1495 },
    ];
    // Vorige snapshot bevat al de finding → delta is leeg.
    h.prevSnapshot = [
      {
        kind: "spookabonnement",
        id: "waste:prov-dup:netflix:1495",
        label: "Netflix: 2× hetzelfde maandbedrag",
        maandIndicatieCents: 1495,
      },
    ];
    const r = await cronGET(cronReq({ authorization: `Bearer ${h.cronSecret}` }));
    const json = await r.json();
    expect(json.notified).toBe(0);
    // Snapshot wordt nog steeds gepersisteerd (diff-base voor volgende run).
    expect(h.rescansCreated).toHaveLength(1);
    expect(h.mailsSent).toHaveLength(0);
  });

  it("active user met open Box 3-claim → finding (geen bedrag, geen verzinnen)", async () => {
    h.users = [{ id: "u1", email: "anne@x.nl" }];
    h.box3Claims = [{ id: "c1", jaar: 2023, verwachteTeruggaveCents: 80_000, status: "AWAITING_PROOF" }];
    const r = await cronGET(cronReq({ authorization: `Bearer ${h.cronSecret}` }));
    expect(r.status).toBe(200);
    expect(h.mailsSent[0]?.subject).toMatch(/1 update/);
    const created = h.rescansCreated[0]?.findingsJson as { snapshot?: RescanFinding[] };
    const snap = created.snapshot ?? [];
    expect(snap.some((f) => f.kind === "box3")).toBe(true);
    // Box 3-claim heeft géén maandbedrag → geen € in mail.
    expect(h.mailsSent[0]?.subject).not.toMatch(/€/);
  });
});
