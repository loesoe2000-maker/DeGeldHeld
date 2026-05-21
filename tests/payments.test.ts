import { describe, it, expect } from "vitest";
import {
  computeSuccessFeeCents,
  createCheckoutSession,
  createFeeSetupSession,
  ensureStripeCustomer,
  reconcileFeeSetupFromSession,
  shouldMarkPaid,
  shouldMarkRefunded,
  shouldMarkFailed,
  verifyAndParseWebhook,
} from "../lib/payments";

describe("payments/computeSuccessFeeCents", () => {
  it("0 for 0 savings", () => {
    expect(computeSuccessFeeCents(0)).toBe(0);
  });

  it("0 for negative savings", () => {
    expect(computeSuccessFeeCents(-100)).toBe(0);
  });

  it("20% of yearly savings", () => {
    expect(computeSuccessFeeCents(20000)).toBe(4000); // 20000 * 0.20
  });

  it("rounds to nearest cent", () => {
    expect(computeSuccessFeeCents(33333)).toBe(6667); // 6666.6 → 6667
  });

  it("enforces €5 minimum", () => {
    expect(computeSuccessFeeCents(1000)).toBe(500); // 20% = 200, raised to 500
  });

  it("respects minimum at 0 too — but returns 0 when nothing saved", () => {
    expect(computeSuccessFeeCents(0)).toBe(0);
  });

  it("scales for large savings", () => {
    expect(computeSuccessFeeCents(100000)).toBe(20000); // 100000 * 0.20
  });
});

describe("payments/shouldMark* event classifiers", () => {
  it.each(["checkout.session.completed", "payment_intent.succeeded"])("PAID: %s", (t) => {
    expect(shouldMarkPaid(t)).toBe(true);
  });
  it("not PAID for unrelated events", () => {
    expect(shouldMarkPaid("payment_intent.created")).toBe(false);
  });

  it.each(["charge.refunded", "charge.refund.updated"])("REFUNDED: %s", (t) => {
    expect(shouldMarkRefunded(t)).toBe(true);
  });

  it.each(["payment_intent.payment_failed", "checkout.session.expired"])("FAILED: %s", (t) => {
    expect(shouldMarkFailed(t)).toBe(true);
  });

  it("classifiers are mutually exclusive for same event", () => {
    const t = "payment_intent.succeeded";
    expect([shouldMarkPaid(t), shouldMarkRefunded(t), shouldMarkFailed(t)].filter(Boolean).length).toBe(1);
  });
});

describe("payments/createCheckoutSession (test mode)", () => {
  it("returns test session when no API key", async () => {
    const r = await createCheckoutSession({
      userEmail: "u@nl",
      negotiationId: "n1",
      yearlySavingsCents: 20000,
      appUrl: "https://example.com",
    });
    expect(r.test).toBe(true);
    expect(r.id).toContain("n1");
    expect(r.amountCents).toBe(4000); // 20% of €200
    expect(r.url).toContain("/pay/n1");
  });

  it("computes fee correctly", async () => {
    const r = await createCheckoutSession({
      userEmail: "u@nl",
      negotiationId: "n1",
      yearlySavingsCents: 50000,
      appUrl: "https://example.com",
    });
    expect(r.amountCents).toBe(10000); // 20% of €500
  });

  it("respects min fee for tiny savings", async () => {
    const r = await createCheckoutSession({
      userEmail: "u@nl",
      negotiationId: "n1",
      yearlySavingsCents: 100,
      appUrl: "https://example.com",
    });
    expect(r.amountCents).toBe(500);
  });
});

describe("payments/createFeeSetupSession (test mode) — return-URL separator", () => {
  it("uses '&' when returnTo already has a query string (no double-?)", async () => {
    const s = await createFeeSetupSession({
      userId: "u1",
      userEmail: "u@nl",
      appUrl: "https://example.com",
      returnTo: "/onderhandel/email?bill=abc123",
    });
    // Regression guard: the old code produced "?bill=abc123?card=ok", which the
    // browser parsed as bill="abc123?card=ok" → bill-not-found → redirect to
    // /onderhandel (upload). That was the endless re-analyse loop.
    expect(s.url).toBe("https://example.com/onderhandel/email?bill=abc123&card=ok");
    expect(s.url).not.toContain("?bill=abc123?card=ok");
  });

  it("uses '?' when returnTo has no query string", async () => {
    const s = await createFeeSetupSession({
      userId: "u1",
      userEmail: "u@nl",
      appUrl: "https://example.com",
      returnTo: "/account",
    });
    expect(s.url).toBe("https://example.com/account?card=ok");
  });
});

describe("payments/ensureStripeCustomer (test mode)", () => {
  it("returns null without real Stripe (dev/dummy mode), never throws", async () => {
    // Real create+persist needs a live key + DB; here we just guard that the
    // dummy-mode short-circuit holds so callers (createFeeSetupSession) degrade.
    const r = await ensureStripeCustomer("user_1", "a@b.nl");
    expect(r).toBeNull();
  });
});

describe("payments/reconcileFeeSetupFromSession (test mode)", () => {
  it("no-ops safely without real Stripe (returns not-configured, never throws)", async () => {
    // Guards the webhook-independent unlock path: it must degrade gracefully
    // in dev/CI (sk_test_dummy) rather than blow up the email page render.
    const r = await reconcileFeeSetupFromSession("cs_test_abc", "user_1");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/stripe not configured/);
  });
});

describe("payments/verifyAndParseWebhook", () => {
  it("error when no secret configured", () => {
    const r = verifyAndParseWebhook("payload", "sig", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/secret/);
  });

  it("error on invalid signature with secret", () => {
    const r = verifyAndParseWebhook("not-a-real-payload", "invalid-sig", "whsec_test");
    expect(r.ok).toBe(false);
  });
});
