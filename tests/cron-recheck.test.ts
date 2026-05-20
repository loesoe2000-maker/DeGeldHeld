import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.CRON_SECRET = "test-cron";

const findMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn(async (_args?: unknown) => ({}) as unknown);
const sendEmail = vi.fn(async (_args?: unknown) => ({ id: "test", skipped: false }));

const cronCreate = vi.fn(async (_a: unknown) => ({ id: "lock-1" }));
const cronUpdate = vi.fn(async (_a: unknown) => ({}));
vi.mock("../lib/db", () => ({
  prisma: {
    bill: {
      findMany: (a: unknown) => findMany(a),
      findFirst: (a: unknown) => findFirst(a),
      update: (a: unknown) => update(a),
    },
    cronRunLog: {
      create: (a: unknown) => cronCreate(a),
      update: (a: unknown) => cronUpdate(a),
    },
  },
}));

vi.mock("../lib/email", () => ({
  sendEmail: (a: unknown) => sendEmail(a),
  // v20: route now escapes the provider in the HTML body — keep a faithful
  // escaper so the mail branch doesn't throw (which would swallow the send).
  escapeHtml: (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;"),
}));

// Pin comparison so we control yearlySavingsCents:
const buildComparisonMock = vi.fn();
vi.mock("../lib/comparison", () => ({
  buildComparison: (...a: unknown[]) => buildComparisonMock(...a),
}));

import { GET } from "../app/api/cron/monthly-recheck/route";
import { NextRequest } from "next/server";

function makeReq(authorized = true) {
  const headers: HeadersInit = authorized ? { authorization: "Bearer test-cron" } : {};
  return new NextRequest("https://t/cron/monthly-recheck", { method: "GET", headers });
}

const baseBill = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  userId: "u1",
  provider: "KPN",
  category: "TELECOM",
  amountCents: 2965,
  monthlyCents: 2965,
  user: { email: "u@x.nl" },
  negotiation: { expectedSavingsCents: 4800 },
  ...over,
});

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset().mockResolvedValue(null);
  update.mockReset().mockResolvedValue({});
  sendEmail.mockReset().mockResolvedValue({ id: "test", skipped: false });
  buildComparisonMock.mockReset();
  cronCreate.mockReset().mockResolvedValue({ id: "lock-1" });
  cronUpdate.mockReset().mockResolvedValue({});
});

describe("GET /api/cron/monthly-recheck", () => {
  it("401 without CRON_SECRET bearer", async () => {
    const res = await GET(makeReq(false));
    expect(res.status).toBe(401);
  });

  it("no due bills → 200 ok, empty stats", async () => {
    findMany.mockResolvedValue([]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.due).toBe(0);
  });

  it("significant delta + no recent mail → mails user, updates lastRecheckMailAt", async () => {
    findMany.mockResolvedValue([baseBill()]);
    findFirst.mockResolvedValue(null);
    buildComparisonMock.mockReturnValue({ bestSavingsCents: 12000 }); // €120/yr vs €48
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mailed).toBe(1);
    expect(sendEmail).toHaveBeenCalled();
    // 2 updates: 1 for lastRecheckMailAt, 1 for next/lastRecheckAt
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("significant delta but recent mail → skipped (cooldown)", async () => {
    findMany.mockResolvedValue([baseBill()]);
    findFirst.mockResolvedValue({ id: "other-bill" });    // recent mail exists
    buildComparisonMock.mockReturnValue({ bestSavingsCents: 12000 });
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.mailed).toBe(0);
    expect(body.skippedCooldown).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("delta below threshold → no mail, but recheck dates still bumped", async () => {
    findMany.mockResolvedValue([baseBill()]);
    buildComparisonMock.mockReturnValue({ bestSavingsCents: 4900 }); // only €1/yr extra
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.mailed).toBe(0);
    expect(body.skippedNoDelta).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastRecheckAt: expect.any(Date), nextRecheckAt: expect.any(Date) }),
      }),
    );
  });

  it("recheck windows: lastRecheck = now, nextRecheck ≈ now+30d", async () => {
    findMany.mockResolvedValue([baseBill()]);
    buildComparisonMock.mockReturnValue({ bestSavingsCents: 4000 });
    await GET(makeReq());
    const lastCall = update.mock.calls[update.mock.calls.length - 1] as unknown as [{ data: { lastRecheckAt: Date; nextRecheckAt: Date } }];
    const delta = lastCall[0].data.nextRecheckAt.getTime() - lastCall[0].data.lastRecheckAt.getTime();
    expect(delta).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(delta).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });
});
