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
    user: {
      findMany: vi.fn(async () => h.users),
      update: (a: unknown) => h.userUpdate(a),
    },
  },
}));

vi.mock("@/lib/notify", () => ({
  sendRetentionEmail: vi.fn(async (o: Record<string, unknown>) => {
    h.sendCalls.push(o);
    return h.sendResult;
  }),
}));

import { GET } from "@/app/api/cron/category-nudge/route";
import { NextRequest } from "next/server";

function req(authorized = true) {
  return new NextRequest("https://t/cron/category-nudge", {
    method: "GET",
    headers: authorized ? { authorization: "Bearer test-cron" } : {},
  });
}

beforeEach(() => {
  h.users = [];
  h.sendResult = { sent: true };
  h.sendCalls = [];
  h.userUpdate.mockClear();
});

describe("v21 category-nudge cron", () => {
  it("401 without CRON_SECRET", async () => {
    const res = await GET(req(false));
    expect(res.status).toBe(401);
  });

  it("user with a category gap → nudged + lastNudgeAt stamped", async () => {
    h.users = [
      {
        id: "u1", email: "a@b.nl", name: "Anne", marketingOptOut: false,
        unsubscribeToken: "t1", lastNudgeAt: null,
        bills: [{ category: "TELECOM" }],
        negotiations: [{ state: "SUCCESS", actualSavingsCents: 12000 }],
      },
    ];
    const res = await GET(req());
    const body = await res.json();
    expect(body.nudged).toBe(1);
    expect(h.sendCalls).toHaveLength(1);
    // names the missing high-value category (ENERGIE)
    expect(String(h.sendCalls[0].subject).toLowerCase()).toContain("energie");
    expect(h.userUpdate).toHaveBeenCalled();
  });

  it("user covering every category → no mail", async () => {
    h.users = [
      {
        id: "u2", email: "c@d.nl", name: null, marketingOptOut: false,
        unsubscribeToken: "t2", lastNudgeAt: null,
        bills: [
          { category: "TELECOM" }, { category: "ENERGIE" }, { category: "VERZEKERING" },
          { category: "HYPOTHEEK" }, { category: "BANK" }, { category: "STREAMING" },
        ],
        negotiations: [{ state: "SUCCESS", actualSavingsCents: 5000 }],
      },
    ];
    const res = await GET(req());
    const body = await res.json();
    expect(body.nudged).toBe(0);
    expect(h.sendCalls).toHaveLength(0);
  });

  it("when the gate declines (throttled/opt-out), lastNudgeAt is NOT stamped", async () => {
    h.sendResult = { sent: false, reason: "throttled" };
    h.users = [
      {
        id: "u3", email: "e@f.nl", name: "Bo", marketingOptOut: false,
        unsubscribeToken: "t3", lastNudgeAt: new Date(),
        bills: [{ category: "TELECOM" }],
        negotiations: [{ state: "SUCCESS", actualSavingsCents: 9000 }],
      },
    ];
    const res = await GET(req());
    const body = await res.json();
    expect(body.nudged).toBe(0);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });
});
