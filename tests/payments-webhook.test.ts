import { describe, it, expect } from "vitest";
import {
  shouldMarkPaid,
  shouldMarkRefunded,
  shouldMarkFailed,
  isSubscriptionEvent,
  subscriptionStatusFromEvent,
  verifyAndParseWebhook,
} from "@/lib/payments";

describe("v18 webhook — event classification", () => {
  it("shouldMarkPaid covers checkout.completed + payment_intent.succeeded", () => {
    expect(shouldMarkPaid("checkout.session.completed")).toBe(true);
    expect(shouldMarkPaid("payment_intent.succeeded")).toBe(true);
    expect(shouldMarkPaid("payment_intent.payment_failed")).toBe(false);
  });

  it("shouldMarkRefunded covers charge.refunded", () => {
    expect(shouldMarkRefunded("charge.refunded")).toBe(true);
    expect(shouldMarkRefunded("charge.refund.updated")).toBe(true);
    expect(shouldMarkRefunded("checkout.session.completed")).toBe(false);
  });

  it("shouldMarkFailed covers payment_intent.payment_failed + checkout.expired", () => {
    expect(shouldMarkFailed("payment_intent.payment_failed")).toBe(true);
    expect(shouldMarkFailed("checkout.session.expired")).toBe(true);
    expect(shouldMarkFailed("payment_intent.succeeded")).toBe(false);
  });
});

describe("v18 webhook — subscription event mapping", () => {
  it("isSubscriptionEvent recognises subscription + invoice events", () => {
    expect(isSubscriptionEvent("customer.subscription.created")).toBe(true);
    expect(isSubscriptionEvent("customer.subscription.updated")).toBe(true);
    expect(isSubscriptionEvent("customer.subscription.deleted")).toBe(true);
    expect(isSubscriptionEvent("invoice.paid")).toBe(true);
    expect(isSubscriptionEvent("invoice.payment_failed")).toBe(true);
    expect(isSubscriptionEvent("checkout.session.completed")).toBe(false);
  });

  it("deleted → canceled, invoice.payment_failed → past_due, invoice.paid → active", () => {
    expect(subscriptionStatusFromEvent("customer.subscription.deleted", "active")).toBe("canceled");
    expect(subscriptionStatusFromEvent("invoice.payment_failed", null)).toBe("past_due");
    expect(subscriptionStatusFromEvent("invoice.paid", null)).toBe("active");
  });

  it("created/updated carry the authoritative Stripe status through", () => {
    expect(subscriptionStatusFromEvent("customer.subscription.created", "active")).toBe("active");
    expect(subscriptionStatusFromEvent("customer.subscription.updated", "past_due")).toBe("past_due");
  });

  it("non-subscription event → null status", () => {
    expect(subscriptionStatusFromEvent("checkout.session.completed", "active")).toBeNull();
  });
});

describe("v18 webhook — signature enforcement", () => {
  it("missing secret → not ok, never processes unsigned", () => {
    const r = verifyAndParseWebhook("{}", "sig", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/secret/);
  });

  it("bad signature → not ok (Stripe lib throws on verify)", () => {
    const r = verifyAndParseWebhook(
      JSON.stringify({ id: "evt_1", type: "checkout.session.completed" }),
      "t=123,v1=deadbeef",
      "whsec_testsecret",
    );
    expect(r.ok).toBe(false);
  });
});

describe("v18 webhook — idempotency contract (source-level)", () => {
  it("route records ProcessedStripeEvent + skips duplicates", () => {
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const src = readFileSync(
      resolve(__dirname, "../app/api/webhooks/stripe/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/processedStripeEvent\.create/);
    expect(src).toMatch(/duplicate/);
    // Missing secret → 500, not silent.
    expect(src).toMatch(/secret not configured/);
    expect(src).toMatch(/status:\s*500/);
    // Failed processing deletes the marker so Stripe retry re-runs.
    expect(src).toMatch(/processedStripeEvent\.delete/);
  });
});
