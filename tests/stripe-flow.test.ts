import { describe, it, expect } from "vitest";
import {
  shouldMarkPaid,
  shouldMarkRefunded,
  shouldMarkFailed,
  computeSuccessFeeCents,
  feeForVerifiedSavings,
} from "@/lib/payments";

/**
 * v14 DEEL 3 — Stripe webhook handler coverage.
 *
 * We don't hit live Stripe from CI; the live-mode drill is in
 * scripts/test-stripe-flow.ts (TODO commit). This suite pins the
 * pure event-classification contract every webhook event in the
 * production endpoint goes through.
 */

describe("Stripe webhook event classification", () => {
  it("checkout.session.completed → mark paid", () => {
    expect(shouldMarkPaid("checkout.session.completed")).toBe(true);
  });

  it("payment_intent.succeeded → mark paid", () => {
    expect(shouldMarkPaid("payment_intent.succeeded")).toBe(true);
  });

  it("payment_intent.payment_failed → mark failed", () => {
    expect(shouldMarkFailed("payment_intent.payment_failed")).toBe(true);
    expect(shouldMarkPaid("payment_intent.payment_failed")).toBe(false);
  });

  it("checkout.session.expired → mark failed", () => {
    expect(shouldMarkFailed("checkout.session.expired")).toBe(true);
  });

  it("charge.refunded → mark refunded", () => {
    expect(shouldMarkRefunded("charge.refunded")).toBe(true);
    expect(shouldMarkRefunded("charge.refund.updated")).toBe(true);
  });

  it("unrelated events do not match any flag", () => {
    const noise = ["customer.created", "invoice.upcoming", "ping.pong"];
    for (const e of noise) {
      expect(shouldMarkPaid(e)).toBe(false);
      expect(shouldMarkFailed(e)).toBe(false);
      expect(shouldMarkRefunded(e)).toBe(false);
    }
  });
});

describe("Stripe legacy success-fee maths (computeSuccessFeeCents)", () => {
  it("returns 15% of yearly with €5 minimum", () => {
    expect(computeSuccessFeeCents(0)).toBe(0); // no savings → no fee
    expect(computeSuccessFeeCents(1000)).toBe(500); // 15% of €10 = €1.50 → bumped to min €5
    expect(computeSuccessFeeCents(10_000)).toBe(1500); // 15% of €100 = €15
  });
});

describe("Stripe v13 verified-savings fee path", () => {
  it("€100/year savings → €20 fee (20%)", () => {
    expect(feeForVerifiedSavings(10_000)).toBe(2000);
  });

  it("€300/year savings → cap at €50", () => {
    expect(feeForVerifiedSavings(30_000)).toBe(5000);
  });
});
