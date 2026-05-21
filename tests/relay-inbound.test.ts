import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v23 DEEL 3 + 4 — inbound relay: provider reply → decision → act.
 */

const h = vi.hoisted(() => ({
  neg: null as Record<string, unknown> | null,
  action: "counter" as "counter" | "accept" | "walk_away" | "escalate",
  offeredCents: 2000 as number | null,
  relaySendResult: { ok: true, messageId: "m", threadId: "t" } as { ok: boolean; reason?: string; messageId?: string; threadId?: string },
  updates: [] as Array<Record<string, unknown>>,
  rounds: [] as Array<Record<string, unknown>>,
  relaySendCalls: 0,
  mails: 0,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findUnique: vi.fn(async () => h.neg),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.updates.push(a.data);
        return {};
      }),
    },
    negotiationRound: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.rounds.push(a.data);
        return { id: `round_${h.rounds.length}` };
      }),
    },
  },
}));

vi.mock("@/lib/rounds", () => ({
  MAX_ROUNDS: 3,
  analyseProviderResponse: vi.fn(async () => ({
    offers: true, offeredCents: h.offeredCents, discountPct: null,
    tone: "constructief", action: h.action, reasoning: "",
  })),
}));

vi.mock("@/lib/relay-send", () => ({
  sendRelayMail: vi.fn(async () => {
    h.relaySendCalls++;
    return h.relaySendResult;
  }),
}));

vi.mock("@/lib/negotiator", () => ({
  generateEmail: vi.fn(async () => ({ subject: "Counter", body: "Kan dit lager?", tonality: "FORMEEL", language: "nl" })),
}));

vi.mock("@/lib/comparison", () => ({ buildComparison: () => ({ topAlternatives: [] }) }));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {
    h.mails++;
    return { id: "x", skipped: false };
  }),
  escapeHtml: (s: string) => s,
}));

import { handleRelayReply } from "@/lib/relay-inbound";

function negFixture(over: Record<string, unknown> = {}) {
  return {
    id: "neg_1", billId: "bill_1", relayToken: "tok", relayState: "RELAY_ACTIVE",
    relayAuthorizedAt: new Date(), relayAutoRounds: 0, providerEmail: "p@kpn.nl",
    bill: { provider: "KPN", category: "TELECOM", monthlyCents: 3000, amountCents: 3000, plan: null, customerNumber: null, country: "NL" },
    user: { name: "Anne", email: "anne@x.nl" },
    rounds: [],
    ...over,
  };
}

beforeEach(() => {
  h.neg = negFixture();
  h.action = "counter";
  h.offeredCents = 2000;
  h.relaySendResult = { ok: true, messageId: "m", threadId: "t" };
  h.updates = [];
  h.rounds = [];
  h.relaySendCalls = 0;
  h.mails = 0;
});

describe("v23 relay inbound — DEEL 3 auto-counter (routine)", () => {
  it("routine counter → auto-sends via relay + records round + notifies", async () => {
    const r = await handleRelayReply({ relayToken: "tok", from: "p@kpn.nl", text: "kleine korting", messageId: "msg1" });
    expect(r).toMatchObject({ ok: true, action: "auto_counter" });
    expect(h.relaySendCalls).toBe(1);
    expect(h.rounds[0].confirmedSentAt).toBeInstanceOf(Date);
    expect(h.mails).toBe(1);
  });
});

describe("v23 relay inbound — DEEL 4 approval gate (KERN)", () => {
  it("a concrete deal (accept) → AWAITING_APPROVAL, NO auto-send", async () => {
    h.action = "accept";
    const r = await handleRelayReply({ relayToken: "tok", from: "p@kpn.nl", text: "akkoord €20", messageId: "msg2" });
    expect(r).toMatchObject({ ok: true, action: "needs_approval" });
    expect(h.relaySendCalls).toBe(0); // never auto-sends a deal acceptance
    expect(h.updates.some((u) => u.relayState === "AWAITING_APPROVAL")).toBe(true);
    expect(h.rounds[0].outcome).toBe("AWAITING_USER_CONFIRM");
    expect(h.mails).toBe(1);
  });

  it("provider account-holder pushback → AWAITING_APPROVAL even on a counter", async () => {
    h.action = "counter";
    const r = await handleRelayReply({
      relayToken: "tok", from: "p@kpn.nl",
      text: "Bent u de contracthouder? We hebben uw akkoord nodig.", messageId: "msg3",
    });
    expect(r).toMatchObject({ ok: true, action: "needs_approval" });
    expect(h.relaySendCalls).toBe(0);
  });

  it("loop-guard: after MAX auto-rounds a counter goes to approval, not auto", async () => {
    h.neg = negFixture({ relayAutoRounds: 5 });
    const r = await handleRelayReply({ relayToken: "tok", from: "p@kpn.nl", text: "korting", messageId: "msg4" });
    expect(r).toMatchObject({ ok: true, action: "needs_approval" });
    expect(h.relaySendCalls).toBe(0);
  });
});

describe("v23 relay inbound — guards", () => {
  it("walk_away → stop + relay paused", async () => {
    h.action = "walk_away";
    const r = await handleRelayReply({ relayToken: "tok", from: "p@kpn.nl", text: "helaas niet mogelijk", messageId: "msg5" });
    expect(r).toMatchObject({ ok: true, action: "stop" });
    expect(h.updates.some((u) => u.relayState === "PAUSED")).toBe(true);
  });

  it("idempotency: a duplicate Message-ID is a no-op (no second counter)", async () => {
    h.neg = negFixture({ rounds: [{ inboundMessageId: "dup" }] });
    const r = await handleRelayReply({ relayToken: "tok", from: "p@kpn.nl", text: "korting", messageId: "dup" });
    expect(r).toMatchObject({ ok: true, action: "noop" });
    expect(h.relaySendCalls).toBe(0);
  });

  it("paused relay → records nothing automatic (no-op)", async () => {
    h.neg = negFixture({ relayState: "PAUSED" });
    const r = await handleRelayReply({ relayToken: "tok", from: "p@kpn.nl", text: "korting", messageId: "msg6" });
    expect(r).toMatchObject({ ok: true, action: "noop" });
    expect(h.relaySendCalls).toBe(0);
  });

  it("unknown/forged token matches nothing (anti-abuse)", async () => {
    h.neg = null;
    const r = await handleRelayReply({ relayToken: "forged", from: "x@y.nl", text: "hi", messageId: "m" });
    expect(r).toMatchObject({ ok: false });
  });
});
