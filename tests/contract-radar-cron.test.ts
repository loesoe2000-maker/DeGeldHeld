import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.CRON_SECRET = "test-cron";

const h = vi.hoisted(() => ({
  bills: [] as Array<Record<string, unknown>>,
  sendResult: { sent: true } as { sent: boolean; reason?: string },
  sendCalls: [] as Array<Record<string, unknown>>,
  billUpdate: vi.fn(async (_a?: unknown) => ({})),
  whereSeen: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: vi.fn(async () => "lock-1"),
  releaseCronLock: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    bill: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) => {
        h.whereSeen = a.where;
        return h.bills;
      }),
      update: (a: unknown) => h.billUpdate(a),
    },
  },
}));

vi.mock("@/lib/notify", () => ({
  sendRetentionEmail: vi.fn(async (o: Record<string, unknown>) => {
    h.sendCalls.push(o);
    return h.sendResult;
  }),
}));

import { GET } from "@/app/api/cron/contract-radar/route";
import { NextRequest } from "next/server";

function req(authorized = true) {
  return new NextRequest("https://t/cron/contract-radar", {
    method: "GET",
    headers: authorized ? { authorization: "Bearer test-cron" } : {},
  });
}

const user = { id: "u1", email: "a@b.nl", name: "Anne", marketingOptOut: false, unsubscribeToken: "t1" };

beforeEach(() => {
  h.bills = [];
  h.sendResult = { sent: true };
  h.sendCalls = [];
  h.billUpdate.mockClear();
  h.whereSeen = null;
});

describe("v21 contract-radar cron", () => {
  it("401 without CRON_SECRET", async () => {
    expect((await GET(req(false))).status).toBe(401);
  });

  it("queries only un-alerted bills with a user not opted-out", async () => {
    await GET(req());
    expect(h.whereSeen?.contractAlertSentAt).toBeNull();
    expect(h.whereSeen?.contractEndDate).toBeDefined();
    expect(h.whereSeen?.user).toEqual({ is: { marketingOptOut: false, deletedAt: null } });
  });

  it("bill ~38 days before end → mails + stamps contractAlertSentAt", async () => {
    h.bills = [
      { id: "b1", provider: "KPN", contractEndDate: new Date(Date.now() + 38 * 86400_000), user },
    ];
    const res = await GET(req());
    const body = await res.json();
    expect(body.alerted).toBe(1);
    expect(h.sendCalls).toHaveLength(1);
    expect(String(h.sendCalls[0].subject)).toContain("KPN");
    expect(h.billUpdate).toHaveBeenCalled();
  });

  it("gate declines → no stamp (so it can retry next run)", async () => {
    h.sendResult = { sent: false, reason: "opted-out" };
    h.bills = [
      { id: "b2", provider: "Ziggo", contractEndDate: new Date(Date.now() + 40 * 86400_000), user },
    ];
    const res = await GET(req());
    expect((await res.json()).alerted).toBe(0);
    expect(h.billUpdate).not.toHaveBeenCalled();
  });
});
