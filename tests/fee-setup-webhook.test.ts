import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v19 DEEL 3 — setup-checkout completion persists the card + mandate.
 */

const h = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return (
          h.users.find((u) =>
            where.id ? u.id === where.id : where.stripeCustomerId ? u.stripeCustomerId === where.stripeCustomerId : false,
          ) ?? null
        );
      }),
      update: vi.fn(async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        h.updates.push(a);
        return {};
      }),
    },
  },
}));

import { isFeeSetupCompleted, persistFeeSetup, type WebhookEvent } from "@/lib/payments";

function evt(over: Partial<WebhookEvent>): WebhookEvent {
  return {
    eventId: "evt_1", type: "checkout.session.completed", negotiationId: null, billId: null,
    kind: null, paymentIntentId: null, sessionId: "cs_1", customerId: "cus_1",
    subscriptionId: null, subscriptionStatus: null, mode: "setup", userId: "u1",
    purpose: "fee-mandate", setupIntentId: "seti_1", ...over,
  };
}

beforeEach(() => {
  h.users = [{ id: "u1", stripeCustomerId: "cus_1" }];
  h.updates = [];
});

describe("v19 isFeeSetupCompleted", () => {
  it("true only for a completed setup-checkout with the fee-mandate purpose", () => {
    expect(isFeeSetupCompleted(evt({}))).toBe(true);
    expect(isFeeSetupCompleted(evt({ mode: "payment" }))).toBe(false);
    expect(isFeeSetupCompleted(evt({ purpose: "other" }))).toBe(false);
    expect(isFeeSetupCompleted(evt({ type: "checkout.session.expired" }))).toBe(false);
  });
});

describe("v19 persistFeeSetup", () => {
  it("saves the payment method + mandate date on the user (by userId)", async () => {
    const r = await persistFeeSetup({ userId: "u1", customerId: "cus_1", paymentMethodId: "pm_123" });
    expect(r.ok).toBe(true);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].data.feePaymentMethodId).toBe("pm_123");
    expect(h.updates[0].data.feeMandateAcceptedAt).toBeInstanceOf(Date);
  });

  it("resolves the user by stripeCustomerId when no userId", async () => {
    const r = await persistFeeSetup({ userId: null, customerId: "cus_1", paymentMethodId: "pm_x" });
    expect(r.ok).toBe(true);
    expect(h.updates[0].where.id).toBe("u1");
  });

  it("returns ok:false when no user reference is given", async () => {
    const r = await persistFeeSetup({ userId: null, customerId: null, paymentMethodId: "pm_x" });
    expect(r.ok).toBe(false);
    expect(h.updates).toHaveLength(0);
  });

  it("returns ok:false when the user can't be found", async () => {
    h.users = [];
    const r = await persistFeeSetup({ userId: "ghost", customerId: null, paymentMethodId: "pm_x" });
    expect(r.ok).toBe(false);
  });
});

describe("v19 idempotency contract (route-level guard)", () => {
  it("the stripe webhook route guards every event via ProcessedStripeEvent", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "../app/api/webhooks/stripe/route.ts"), "utf8");
    expect(src).toMatch(/processedStripeEvent\.create/);
    expect(src).toMatch(/isFeeSetupCompleted/);
  });
});
