import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v25 DEEL 3 — full thread simulation through the inbound decision engine,
 * with a STATEFUL in-memory negotiation so each provider reply sees the state
 * the previous one left behind:
 *
 *   send → "kan niet" → auto_counter → ... → loop-guard → needs_approval
 *   send → "deal voor €X" → needs_approval (NEVER auto-accept)
 *
 * The acceptance step itself is the human-only relay-approve route (covered in
 * relay-approve.test.ts) — here we prove the relay hands back at a deal and
 * the loop-guard fires, never auto-committing.
 */
const h = vi.hoisted(() => ({
  neg: null as Record<string, unknown> | null,
  rounds: [] as Array<Record<string, unknown>>,
  action: "counter" as "counter" | "accept" | "walk_away" | "escalate",
  mails: 0,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findUnique: vi.fn(async () => (h.neg ? { ...h.neg, rounds: h.rounds } : null)),
      findFirst: vi.fn(async () => (h.neg ? { ...h.neg, rounds: h.rounds } : null)),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (h.neg) Object.assign(h.neg, a.data);
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
  MAX_ROUNDS: 99, // isolate the MAX_AUTO_ROUNDS=5 guard for this sim
  analyseProviderResponse: vi.fn(async () => ({
    offers: true, offeredCents: 2000, discountPct: null,
    tone: "constructief", action: h.action, reasoning: "",
  })),
}));

// Stateful relay-send mock: a counter increments the loop-guard, just like
// the real sendRelayMail does, so the guard can actually be reached.
vi.mock("@/lib/relay-send", () => ({
  sendRelayMail: vi.fn(async (o: { kind: string }) => {
    if (o.kind === "counter" && h.neg) {
      h.neg.relayAutoRounds = (h.neg.relayAutoRounds as number) + 1;
    }
    return { ok: true, messageId: "m", threadId: "t" };
  }),
}));
vi.mock("@/lib/negotiator", () => ({
  generateEmail: vi.fn(async () => ({ subject: "Counter", body: "Kan dit lager?", tonality: "FORMEEL", language: "nl" })),
}));
vi.mock("@/lib/comparison", () => ({ buildComparison: () => ({ topAlternatives: [] }) }));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => { h.mails++; return { id: "x", skipped: false }; }),
  escapeHtml: (s: string) => s,
}));

import { handleRelayReply } from "@/lib/relay-inbound";

function reply(text: string, messageId: string) {
  return handleRelayReply({ relayToken: "tok", from: "p@kpn.nl", text, messageId });
}

beforeEach(() => {
  h.rounds = [];
  h.action = "counter";
  h.mails = 0;
  h.neg = {
    id: "neg_1", billId: "bill_1", relayToken: "tok", relayState: "RELAY_ACTIVE",
    relayAuthorizedAt: new Date(), relayAutoRounds: 0, providerEmail: "p@kpn.nl",
    bill: { provider: "KPN", category: "TELECOM", monthlyCents: 3000, amountCents: 3000, plan: null, customerNumber: null, country: "NL" },
    user: { name: "Anne", email: "anne@x.nl" },
  };
}); // rounds injected via findUnique

describe("v25 relay thread — stateful loop", () => {
  it("counters routine replies until the loop-guard hands back at round 5", async () => {
    // 5 routine "can't do much" replies → 5 auto-counters.
    for (let i = 1; i <= 5; i++) {
      const r = await reply("we kunnen weinig", `m${i}`);
      expect(r).toMatchObject({ action: "auto_counter" });
    }
    expect((h.neg as { relayAutoRounds: number }).relayAutoRounds).toBe(5);

    // 6th reply: loop-guard exhausted → needs_approval, no further auto-send.
    const guard = await reply("nogmaals weinig", "m6");
    expect(guard).toMatchObject({ action: "needs_approval" });
    expect((h.neg as { relayState: string }).relayState).toBe("AWAITING_APPROVAL");
  });

  it("hands a concrete deal back to the customer (never auto-accepts)", async () => {
    const r1 = await reply("we kunnen niets doen", "a1");
    expect(r1).toMatchObject({ action: "auto_counter" });

    h.action = "accept"; // provider now offers a concrete acceptable deal
    const r2 = await reply("akkoord: €20 per maand", "a2");
    expect(r2).toMatchObject({ action: "needs_approval" });
    expect((h.neg as { relayState: string }).relayState).toBe("AWAITING_APPROVAL");
    // The last round awaits the human, it is NOT marked accepted.
    expect(h.rounds.at(-1)?.outcome).toBe("AWAITING_USER_CONFIRM");
  });

  it("a provider account-holder check stops the automatic path immediately", async () => {
    const r = await reply("Bent u de contracthouder? We hebben uw handtekening nodig.", "b1");
    expect(r).toMatchObject({ action: "needs_approval" });
    expect((h.neg as { relayState: string }).relayState).toBe("AWAITING_APPROVAL");
  });

  it("a walk-away pauses the relay (hand back, no more sends)", async () => {
    h.action = "walk_away";
    const r = await reply("we gaan niet akkoord, einde gesprek", "c1");
    expect(r).toMatchObject({ action: "stop" });
    expect((h.neg as { relayState: string }).relayState).toBe("PAUSED");
  });
});
