import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v23 DEEL 4 (KERN) — human approval gate. Only an explicit owner action
 * accepts; acceptance never marks a saving 'verified'; stop pauses.
 */
const h = vi.hoisted(() => ({
  userId: "u1" as string | null,
  neg: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
  roundUpdateMany: 0,
  relaySendCalls: 0,
}));

// Relay is flag-gated (v25); these tests exercise the enabled path.
vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => true }));

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (h.userId ? { user: { id: h.userId } } : null)) }));

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findFirst: vi.fn(async () => h.neg),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.updates.push(a.data);
        return {};
      }),
    },
    negotiationRound: { updateMany: vi.fn(async () => { h.roundUpdateMany++; return { count: 1 }; }) },
  },
}));

vi.mock("@/lib/relay-send", () => ({
  sendRelayMail: vi.fn(async () => { h.relaySendCalls++; return { ok: true, messageId: "m", threadId: "t" }; }),
}));
vi.mock("@/lib/negotiator", () => ({
  generateEmail: vi.fn(async () => ({ subject: "Counter", body: "lager?", tonality: "FORMEEL", language: "nl" })),
}));
vi.mock("@/lib/comparison", () => ({ buildComparison: () => ({ topAlternatives: [] }) }));

import { POST } from "@/app/api/negotiations/[id]/relay-approve/route";

function req(action: unknown) {
  return new Request("https://t/api/negotiations/neg_1/relay-approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
const ctx = { params: Promise.resolve({ id: "neg_1" }) };

function negFixture(over: Record<string, unknown> = {}) {
  return {
    id: "neg_1", billId: "bill_1", relayState: "AWAITING_APPROVAL",
    bill: { provider: "KPN", category: "TELECOM", monthlyCents: 3000, amountCents: 3000, plan: null, customerNumber: null, country: "NL" },
    user: { name: "Anne", email: "anne@x.nl" },
    rounds: [{ offeredCents: 2000 }],
    ...over,
  };
}

beforeEach(() => {
  h.userId = "u1";
  h.neg = negFixture();
  h.updates = [];
  h.roundUpdateMany = 0;
  h.relaySendCalls = 0;
});

describe("v23 relay-approve gate", () => {
  it("401 when unauthenticated", async () => {
    h.userId = null;
    expect((await POST(req("accept"), ctx)).status).toBe(401);
  });

  it("400 on an invalid action", async () => {
    expect((await POST(req("nope"), ctx)).status).toBe(400);
  });

  it("409 when not awaiting approval", async () => {
    h.neg = negFixture({ relayState: "RELAY_ACTIVE" });
    expect((await POST(req("accept"), ctx)).status).toBe(409);
  });

  it("accept → sends acceptance, closes relay (DONE), never marks saving verified", async () => {
    const res = await POST(req("accept"), ctx);
    expect(res.status).toBe(200);
    expect(h.relaySendCalls).toBe(1);
    // closed
    expect(h.updates.some((u) => u.relayState === "DONE")).toBe(true);
    // GUARDRAIL: no actualSavingsCents / proofVerifiedAt set anywhere here
    for (const u of h.updates) {
      expect(u).not.toHaveProperty("actualSavingsCents");
      expect(u).not.toHaveProperty("proofVerifiedAt");
    }
  });

  it("continue → resumes relaying + sends one counter", async () => {
    const res = await POST(req("continue"), ctx);
    expect(res.status).toBe(200);
    expect(h.relaySendCalls).toBe(1);
    expect(h.updates.some((u) => u.relayState === "RELAY_ACTIVE")).toBe(true);
  });

  it("stop → pauses, sends nothing", async () => {
    const res = await POST(req("stop"), ctx);
    expect(res.status).toBe(200);
    expect(h.relaySendCalls).toBe(0);
    expect(h.updates.some((u) => u.relayState === "PAUSED")).toBe(true);
  });
});
