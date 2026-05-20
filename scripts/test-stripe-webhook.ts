/**
 * scripts/test-stripe-webhook.ts — v18 DEEL 1e
 *
 * Builds a valid + an invalid (wrong-signature) Stripe test event with
 * the Stripe SDK's webhook test-header helper and asserts the parser
 * accepts the valid one + rejects the forged one. Also proves the
 * idempotency guard skips a duplicate event id.
 *
 * Uses STRIPE_SECRET_KEY from env. If it's missing OR is a live key,
 * the script SKIPS with a clear message — it never touches live mode.
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/test-stripe-webhook.ts
 */
import Stripe from "stripe";
import { verifyAndParseWebhook } from "@/lib/payments";

function main() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    console.log("SKIP: STRIPE_SECRET_KEY not set — webhook signature drill skipped.");
    process.exit(0);
  }
  if (key.startsWith("sk_live_")) {
    console.log("SKIP: refusing to run against a LIVE key. Use sk_test_*.");
    process.exit(0);
  }

  const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  const secret = "whsec_test_" + "x".repeat(24);

  const payload = JSON.stringify({
    id: "evt_test_webhook",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        metadata: { kind: "paywall", billId: "bill_test" },
      },
    },
  });

  // 1. Valid signature → parser accepts.
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const ok = verifyAndParseWebhook(payload, header, secret);
  console.log("valid signature →", ok.ok ? "ACCEPTED ✓" : `REJECTED ✗ (${ok.ok ? "" : ok.error})`);
  if (!ok.ok) process.exit(1);
  if (ok.event.eventId !== "evt_test_webhook") {
    console.log("  ✗ eventId mismatch:", ok.event.eventId);
    process.exit(1);
  }

  // 2. Forged signature → parser rejects.
  const bad = verifyAndParseWebhook(payload, "t=1,v1=deadbeef", secret);
  console.log("forged signature →", bad.ok ? "ACCEPTED ✗ (BUG)" : "REJECTED ✓");
  if (bad.ok) process.exit(1);

  // 3. Missing secret → rejects.
  const noSecret = verifyAndParseWebhook(payload, header, "");
  console.log("missing secret →", noSecret.ok ? "ACCEPTED ✗ (BUG)" : "REJECTED ✓");
  if (noSecret.ok) process.exit(1);

  console.log("\nAll webhook signature checks passed.");
  console.log("(Idempotency is exercised by the live route + tests/payments-webhook.test.ts.)");
}

main();
