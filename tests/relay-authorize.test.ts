import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v25 DEEL 0 — relay-authorize is double-gated:
 *   1. FEATURE_RELAY_ENABLED off → 404 disabled (relay doesn't exist).
 *   2. on, but no fee-card + accepted mandate → 409 card-required
 *      (GUARDRAIL 4: "wij doen het werk" → a proven saving must be chargeable).
 *   3. on + card on file → authorized; with a providerEmail the first mail
 *      goes out on behalf (consent-gated inside sendFirstRelayMail).
 */
const h = vi.hoisted(() => ({
  flagOn: true,
  userId: "u1" as string | null,
  neg: null as Record<string, unknown> | null,
  user: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
  firstSends: 0,
}));

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => h.flagOn }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (h.userId ? { user: { id: h.userId } } : null)) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findFirst: vi.fn(async () => h.neg),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => { h.updates.push(a.data); return {}; }),
    },
    user: { findUnique: vi.fn(async () => h.user) },
  },
}));
vi.mock("@/lib/relay-send", () => ({
  sendFirstRelayMail: vi.fn(async () => { h.firstSends++; return { ok: true, messageId: "m", threadId: "t" }; }),
}));

import { POST } from "@/app/api/negotiations/[id]/relay-authorize/route";

function req(body: unknown) {
  return new Request("https://t/api/negotiations/neg_1/relay-authorize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "neg_1" }) };

beforeEach(() => {
  h.flagOn = true;
  h.userId = "u1";
  h.neg = { id: "neg_1", billId: "bill_1", relayToken: null, bill: { provider: "KPN" } };
  h.user = { feePaymentMethodId: "pm_123", feeMandateAcceptedAt: new Date() };
  h.updates = [];
  h.firstSends = 0;
});

describe("v25 relay-authorize gate", () => {
  it("404 disabled when FEATURE_RELAY_ENABLED is off", async () => {
    h.flagOn = false;
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe("disabled");
    expect(h.updates).toHaveLength(0);
  });

  it("401 when unauthenticated", async () => {
    h.userId = null;
    expect((await POST(req({}), ctx)).status).toBe(401);
  });

  it("404 when the negotiation isn't the caller's", async () => {
    h.neg = null;
    expect((await POST(req({}), ctx)).status).toBe(404);
  });

  it("409 card-required when no fee payment method", async () => {
    h.user = { feePaymentMethodId: null, feeMandateAcceptedAt: new Date() };
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("card-required");
    expect(h.updates).toHaveLength(0);
  });

  it("409 card-required when the mandate wasn't accepted", async () => {
    h.user = { feePaymentMethodId: "pm_123", feeMandateAcceptedAt: null };
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("card-required");
  });

  it("authorizes with a card on file → RELAY_ACTIVE", async () => {
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.relayState).toBe("RELAY_ACTIVE");
    expect(h.updates[0].relayState).toBe("RELAY_ACTIVE");
    expect(h.updates[0].relayAuthorizedAt).toBeInstanceOf(Date);
    // No provider address supplied → no first send.
    expect(h.firstSends).toBe(0);
    expect(body.firstSend).toBe("no-provider-address");
  });

  it("with a providerEmail → stores it + fires the first relay mail", async () => {
    const res = await POST(req({ providerEmail: "retentie@kpn.com" }), ctx);
    expect(res.status).toBe(200);
    expect(h.updates[0].providerEmail).toBe("retentie@kpn.com");
    expect(h.firstSends).toBe(1);
    expect((await res.json()).firstSend).toBe("sent");
  });

  it("rejects an invalid provider email (not stored)", async () => {
    const res = await POST(req({ providerEmail: "not-an-email" }), ctx);
    expect(res.status).toBe(200);
    expect(h.updates[0]).not.toHaveProperty("providerEmail");
    expect(h.firstSends).toBe(0);
  });
});
