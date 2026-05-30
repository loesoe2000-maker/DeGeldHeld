import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v25 DEEL 5 — full end-to-end relay loop against a SIMULATED provider mailbox.
 *
 * Only the true boundaries are mocked: the database (a stateful in-memory
 * negotiation), the mail transport (a captured "mailbox" array), auth, the
 * feature-flag, and the LLM helpers. Everything in between runs for real —
 * the relay-authorize route, sendFirstRelayMail/sendRelayMail (incl. the
 * canRelaySend consent gate + RFC-5322 headers), and handleRelayReply's
 * decision engine.
 *
 * Asserts the whole journey AND the two hard guardrails: no mail leaves
 * without consent, and a deal is NEVER auto-accepted.
 */

const store = vi.hoisted(() => ({
  flagOn: true,
  userId: "u1" as string | null,
  user: { feePaymentMethodId: "pm_1", feeMandateAcceptedAt: new Date() } as Record<string, unknown> | null,
  neg: null as Record<string, unknown> | null,
  rounds: [] as Array<Record<string, unknown>>,
  mailbox: [] as Array<Record<string, unknown>>,
  providerAction: "counter" as "counter" | "accept" | "walk_away",
}));

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => store.flagOn }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (store.userId ? { user: { id: store.userId } } : null)) }));

// Stateful prisma: every finder returns the live negotiation (+ rounds);
// updates mutate it in place; rounds accumulate.
vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findFirst: vi.fn(async () => (store.neg ? { ...store.neg, bill: store.neg.bill, rounds: store.rounds } : null)),
      findUnique: vi.fn(async () => (store.neg ? { ...store.neg, bill: store.neg.bill, user: store.neg.user, rounds: store.rounds } : null)),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => { if (store.neg) Object.assign(store.neg, a.data); return {}; }),
    },
    negotiationRound: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => { store.rounds.push(a.data); return { id: `r${store.rounds.length}` }; }),
      updateMany: vi.fn(async () => ({ count: store.rounds.length })),
    },
    user: { findUnique: vi.fn(async () => store.user) },
  },
}));

// The simulated provider mailbox: capture every outbound mail.
vi.mock("@/lib/email", async () => {
  const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...real,
    sendEmail: vi.fn(async (o: Record<string, unknown>) => { store.mailbox.push(o); return { id: `m${store.mailbox.length}`, skipped: false }; }),
  };
});

vi.mock("@/lib/rounds", () => ({
  MAX_ROUNDS: 99,
  analyseProviderResponse: vi.fn(async () => ({
    offers: true, offeredCents: 2000, discountPct: null,
    tone: "constructief", action: store.providerAction, reasoning: "",
  })),
}));
vi.mock("@/lib/negotiator", () => ({
  generateEmail: vi.fn(async () => ({ subject: "Counter KPN", body: "Kan dit lager?", tonality: "FORMEEL", language: "nl" })),
}));
vi.mock("@/lib/comparison", () => ({ buildComparison: () => ({ topAlternatives: [] }) }));

import { POST as authorizePOST } from "@/app/api/negotiations/[id]/relay-authorize/route";
import { POST as approvePOST } from "@/app/api/negotiations/[id]/relay-approve/route";
import { handleRelayReply } from "@/lib/relay-inbound";

const ctx = { params: Promise.resolve({ id: "neg_1" }) };
function authReq(body: unknown) {
  return new Request("https://t/api/negotiations/neg_1/relay-authorize", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
function approveReq(action: string) {
  return new Request("https://t/api/negotiations/neg_1/relay-approve", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }),
  });
}

beforeEach(() => {
  store.flagOn = true;
  store.userId = "u1";
  store.user = { feePaymentMethodId: "pm_1", feeMandateAcceptedAt: new Date() };
  store.rounds = [];
  store.mailbox = [];
  store.providerAction = "counter";
  // v37: relay is alleen voor fee-categorieën (TYPE_A_NCNP). TELECOM wordt nu
  // hard geweigerd door de categorie-gate in relay-authorize, dus deze e2e-
  // loop draait op ENERGIE (fee:true) — een categorie die wél mag relayen.
  store.neg = {
    id: "neg_1", billId: "bill_1", userId: "u1",
    relayToken: null, relayState: null, relayAuthorizedAt: null, relayAutoRounds: 0,
    providerEmail: null, providerThreadId: null,
    emailSubject: "Verzoek tariefherziening Vattenfall", emailBody: "Beste Vattenfall, graag een lager tarief.",
    bill: { provider: "Vattenfall", category: "ENERGIE", monthlyCents: 3000, amountCents: 3000, plan: null, customerNumber: null, country: "NL" },
    user: { name: "Anne", email: "anne@x.nl" },
  };
});

// Mail addressed to the provider (vs. customer notifications, which also flow
// through the same transport and are expected/desired).
const toProvider = () => store.mailbox.filter((m) => m.to === "retentie@kpn.nl");

describe("v25 e2e relay loop (simulated mailbox)", () => {
  it("authorize → send → counter → deal → human-accept → DONE", async () => {
    // 1. Authorize with the provider address → first mail goes out on behalf.
    const a = await authorizePOST(authReq({ providerEmail: "retentie@kpn.nl" }), ctx);
    expect(a.status).toBe(200);
    expect((store.neg as { relayState: string }).relayState).toBe("RELAY_ACTIVE");
    expect(toProvider()).toHaveLength(1);
    const first = store.mailbox[0];
    expect(first.to).toBe("retentie@kpn.nl");
    expect(String(first.from)).toMatch(/^Anne via DeGeldHeld <[^@\s]+@degeldheld\.com>$/);
    expect(String(first.replyTo)).toMatch(/^onderhandel\+.+@/);
    expect(String(first.subject)).toContain("[NEGOTIATION-neg_1]");
    const headers = first.headers as Record<string, string>;
    expect(headers["Message-ID"]).toBeTruthy();
    expect(headers["References"]).toBe(headers["Message-ID"]);

    const token = (store.neg as { relayToken: string }).relayToken;
    expect(token).toBeTruthy();

    // 2. Provider replies "we kunnen weinig" → routine auto-counter goes out.
    store.providerAction = "counter";
    const r1 = await handleRelayReply({ relayToken: token, from: "retentie@kpn.nl", text: "we kunnen weinig doen", messageId: "p1" });
    expect(r1).toMatchObject({ ok: true, action: "auto_counter" });
    expect(toProvider()).toHaveLength(2); // a real counter was sent on behalf

    // 3. Provider offers a concrete deal → AWAITING_APPROVAL, NO auto-send.
    store.providerAction = "accept";
    const r2 = await handleRelayReply({ relayToken: token, from: "retentie@kpn.nl", text: "akkoord: €20 per maand", messageId: "p2" });
    expect(r2).toMatchObject({ ok: true, action: "needs_approval" });
    expect(toProvider()).toHaveLength(2); // unchanged — never auto-accepts a deal
    expect((store.neg as { relayState: string }).relayState).toBe("AWAITING_APPROVAL");

    // 4. Human accepts via the relay-approve route → acceptance mail + DONE.
    const ap = await approvePOST(approveReq("accept"), ctx);
    expect(ap.status).toBe(200);
    const provMails = toProvider();
    expect(provMails).toHaveLength(3);
    expect(String(provMails[2].subject)).toContain("Akkoord");
    expect((store.neg as { relayState: string }).relayState).toBe("DONE");
    // GUARDRAIL: acceptance never marks a saving verified.
    expect(store.neg).not.toHaveProperty("actualSavingsCents");
    expect(store.neg).not.toHaveProperty("proofVerifiedAt");
  });

  it("GUARDRAIL 1 — a paused relay sends nothing on a provider reply", async () => {
    await authorizePOST(authReq({ providerEmail: "retentie@kpn.nl" }), ctx);
    const token = (store.neg as { relayToken: string }).relayToken;
    store.mailbox = [];
    (store.neg as { relayState: string }).relayState = "PAUSED";

    const r = await handleRelayReply({ relayToken: token, from: "retentie@kpn.nl", text: "korting?", messageId: "p9" });
    expect(r).toMatchObject({ ok: true, action: "noop" });
    expect(toProvider()).toHaveLength(0); // consent gate held — nothing to provider
  });

  it("GUARDRAIL 4 — no fee-card on file → authorize 409, nothing sent", async () => {
    store.user = { feePaymentMethodId: null, feeMandateAcceptedAt: null };
    const a = await authorizePOST(authReq({ providerEmail: "retentie@kpn.nl" }), ctx);
    expect(a.status).toBe(409);
    expect(store.mailbox).toHaveLength(0);
    expect((store.neg as { relayState: string | null }).relayState).toBeNull();
  });

  it("GUARDRAIL 7 — flag off → authorize 404 disabled, nothing sent", async () => {
    store.flagOn = false;
    const a = await authorizePOST(authReq({ providerEmail: "retentie@kpn.nl" }), ctx);
    expect(a.status).toBe(404);
    expect(store.mailbox).toHaveLength(0);
  });

  it("walk-away → relay paused, no further automatic mail", async () => {
    await authorizePOST(authReq({ providerEmail: "retentie@kpn.nl" }), ctx);
    const token = (store.neg as { relayToken: string }).relayToken;
    store.mailbox = [];
    store.providerAction = "walk_away";
    const r = await handleRelayReply({ relayToken: token, from: "retentie@kpn.nl", text: "nee, einde", messageId: "pX" });
    expect(r).toMatchObject({ ok: true, action: "stop" });
    expect((store.neg as { relayState: string }).relayState).toBe("PAUSED");
    expect(toProvider()).toHaveLength(0); // no further mail to the provider
  });
});
