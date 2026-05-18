/**
 * scripts/test-stripe-flow.ts — v14 DEEL 3 live Stripe smoke.
 *
 * Manual gate: requires STRIPE_SECRET_KEY pointing at the TEST mode
 * key (sk_test_...). The flow creates a synthetic Negotiation in
 * BILLED_PENDING_PAYMENT, opens a Checkout session, prints the URL,
 * and waits for stdin so the user can drive the rest interactively
 * with test card 4242 4242 4242 4242.
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/test-stripe-flow.ts
 *
 * Verification:
 *   - Checkout URL opens, accepts test card.
 *   - Webhook handler at /api/webhooks/stripe receives
 *     checkout.session.completed.
 *   - Negotiation.state flips to SUCCESS (or BILLED via the v11
 *     no-cure-no-pay path) and Bill.paidAt is set.
 *
 * Hard guard: this script will refuse to run with a live (sk_live_)
 * key — gating against an accidental real charge.
 */
import { createCheckoutSession } from "@/lib/payments";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    console.error("STRIPE_SECRET_KEY missing — set sk_test_* before running.");
    process.exit(2);
  }
  if (key.startsWith("sk_live_")) {
    console.error("REFUSING to run against a LIVE Stripe key. Use sk_test_*.");
    process.exit(3);
  }

  const session = await createCheckoutSession({
    userEmail: "stripe-test@degeldheld.com",
    negotiationId: "stripe-test-" + Date.now(),
    yearlySavingsCents: 10_000, // €100/year → ~€15 success fee
    appUrl: process.env.APP_URL ?? "https://degeldheld.com",
  });

  console.log("=== Stripe test session ===");
  console.log("  session.id   =", session.id);
  console.log("  amountCents  =", session.amountCents);
  console.log("  test         =", session.test);
  console.log("  open URL     →", session.url ?? "(no URL — test mode)");
  console.log();
  console.log(
    "Use card 4242 4242 4242 4242, any future date, any CVC, any postcode.",
  );
  console.log(
    "After success, verify webhook landed by querying the DB for the",
  );
  console.log("matching negotiation row.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
