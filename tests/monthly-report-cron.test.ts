import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.CRON_SECRET = "test-cron";

const h = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  sendResult: { sent: true } as { sent: boolean; reason?: string },
  sendCalls: [] as Array<Record<string, unknown>>,
  userUpdate: vi.fn(async (_a?: unknown) => ({})),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: vi.fn(async () => "lock-1"),
  releaseCronLock: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: vi.fn(async () => h.users), update: (a: unknown) => h.userUpdate(a) },
  },
}));

vi.mock("@/lib/notify", () => ({
  sendRetentionEmail: vi.fn(async (o: Record<string, unknown>) => {
    h.sendCalls.push(o);
    return h.sendResult;
  }),
}));

import { GET, sameMonth } from "@/app/api/cron/monthly-report/route";
import { NextRequest } from "next/server";

function req(authorized = true) {
  return new NextRequest("https://t/cron/monthly-report", {
    method: "GET",
    headers: authorized ? { authorization: "Bearer test-cron" } : {},
  });
}

function user(over: Record<string, unknown> = {}) {
  return {
    id: "u1", email: "a@b.nl", name: "Anne", marketingOptOut: false,
    unsubscribeToken: "t1", lastMonthlyReportAt: null,
    bills: [{ category: "TELECOM", nextRecheckAt: null }],
    negotiations: [{ state: "SUCCESS", actualSavingsCents: 12000 }],
    ...over,
  };
}

beforeEach(() => {
  h.users = [];
  h.sendResult = { sent: true };
  h.sendCalls = [];
  h.userUpdate.mockClear();
});

describe("v21 monthly-report cron", () => {
  it("sameMonth helper", () => {
    expect(sameMonth(new Date("2026-05-01"), new Date("2026-05-28"))).toBe(true);
    expect(sameMonth(new Date("2026-05-01"), new Date("2026-06-01"))).toBe(false);
  });

  it("401 without CRON_SECRET", async () => {
    expect((await GET(req(false))).status).toBe(401);
  });

  it("sends a digest + stamps lastMonthlyReportAt", async () => {
    h.users = [user()];
    const body = await (await GET(req())).json();
    expect(body.sent).toBe(1);
    expect(h.sendCalls).toHaveLength(1);
    expect(String(h.sendCalls[0].text)).toContain("Totaal bespaard: €120");
    expect(h.userUpdate).toHaveBeenCalled();
  });

  it("skips a user already reported this month", async () => {
    h.users = [user({ lastMonthlyReportAt: new Date() })];
    const body = await (await GET(req())).json();
    expect(body.sent).toBe(0);
    expect(h.sendCalls).toHaveLength(0);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });

  it("opt-out is enforced by the gate (no stamp on decline)", async () => {
    h.sendResult = { sent: false, reason: "opted-out" };
    h.users = [user()];
    const body = await (await GET(req())).json();
    expect(body.sent).toBe(0);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });
});
