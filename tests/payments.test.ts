import { describe, it, expect } from "vitest";
import {
  computeSuccessFeeCents,
  createCheckoutSession,
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

  it("15% of yearly savings", () => {
    expect(computeSuccessFeeCents(20000)).toBe(3000); // 20000 * 0.15
  });

  it("rounds to nearest cent", () => {
    expect(computeSuccessFeeCents(33333)).toBe(5000); // 4999.95 → 5000
  });

  it("enforces €5 minimum", () => {
    expect(computeSuccessFeeCents(1000)).toBe(500); // 15% = 150, raised to 500
  });

  it("respects minimum at 0 too — but returns 0 when nothing saved", () => {
    expect(computeSuccessFeeCents(0)).toBe(0);
  });

  it("scales for large savings", () => {
    expect(computeSuccessFeeCents(100000)).toBe(15000);
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
    expect(r.amountCents).toBe(3000);
    expect(r.url).toContain("/pay/n1");
  });

  it("computes fee correctly", async () => {
    const r = await createCheckoutSession({
      userEmail: "u@nl",
      negotiationId: "n1",
      yearlySavingsCents: 50000,
      appUrl: "https://example.com",
    });
    expect(r.amountCents).toBe(7500);
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
