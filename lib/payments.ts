/**
 * Stripe billing — two models:
 *   1. Success-fee (15% of yearly savings) on negotiation outcome — legacy.
 *   2. Per-bill flat fee paywall after the first free bill — DEEL 10.
 */

import Stripe from "stripe";
import { prisma } from "./db";

const SUCCESS_FEE_PCT = 0.15;
const MIN_BILL_CENTS = 500; // €5,00 minimum
/** Flat per-bill fee charged after the first free bill (DEEL 10). */
export const PAYWALL_FEE_CENTS = 499; // €4,99

// ─────────────────────────────────────────────────────────────
// v11 — no-cure-no-pay pricing (FEATURE_NO_CURE_NO_PAY)
// User explicitly set the rate at 20% (top of the industry
// no-cure-no-pay range). Cap and floor are kept tight so the
// fee never feels punitive: max €25, min €2.
// ─────────────────────────────────────────────────────────────
export const NO_CURE_NO_PAY_FEE_PCT = 0.20;
export const NO_CURE_NO_PAY_FEE_CAP_CENTS = 2500; // €25,00
export const NO_CURE_NO_PAY_FEE_FLOOR_CENTS = 200; // €2,00
/** Yearly savings below this threshold (€50) never trigger a fee. */
export const NO_CURE_NO_PAY_MIN_SAVINGS_CENTS = 5000;

const apiKey = process.env.STRIPE_SECRET_KEY ?? "";
let _stripe: Stripe | null = null;
function client(): Stripe {
  if (!_stripe) _stripe = new Stripe(apiKey, { apiVersion: "2025-02-24.acacia" });
  return _stripe;
}

export function computeSuccessFeeCents(yearlySavingsCents: number): number {
  if (yearlySavingsCents <= 0) return 0;
  const fee = Math.round(yearlySavingsCents * SUCCESS_FEE_PCT);
  return Math.max(fee, MIN_BILL_CENTS);
}

/**
 * v11 no-cure-no-pay fee on a verified savings flow.
 *
 *  - Returns 0 when yearly savings < €50 (sub-threshold).
 *  - Otherwise: 20% of yearly savings, clamped to [€2, €25].
 *
 * Pure function — no side effects, no DB calls. Callers (the
 * fee-trigger after proof verification, the smoke checks) consume
 * this directly.
 */
export function feeForVerifiedSavings(actualSavingsCents: number): number {
  if (actualSavingsCents < NO_CURE_NO_PAY_MIN_SAVINGS_CENTS) return 0;
  const raw = Math.round(actualSavingsCents * NO_CURE_NO_PAY_FEE_PCT);
  if (raw < NO_CURE_NO_PAY_FEE_FLOOR_CENTS) return NO_CURE_NO_PAY_FEE_FLOOR_CENTS;
  if (raw > NO_CURE_NO_PAY_FEE_CAP_CENTS) return NO_CURE_NO_PAY_FEE_CAP_CENTS;
  return raw;
}

/**
 * Should this user actually be charged a no-cure-no-pay fee? Returns
 * false for admins (ADMIN_EMAILS) and when the feature flag is off.
 *
 * Note: this only validates *eligibility*. The caller still needs to
 * verify that proof has landed (proofVerifiedAt != null).
 */
export async function shouldChargeVerifiedFee(opts: {
  userId: string;
  actualSavingsCents: number;
}): Promise<boolean> {
  if (process.env.FEATURE_NO_CURE_NO_PAY !== "true") return false;
  if (opts.actualSavingsCents < NO_CURE_NO_PAY_MIN_SAVINGS_CENTS) return false;
  const adminList = (process.env.ADMIN_EMAILS ?? "").toLowerCase();
  if (adminList) {
    const u = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { email: true },
    });
    const admins = adminList.split(",").map((e) => e.trim()).filter(Boolean);
    if (u?.email && admins.includes(u.email.toLowerCase())) return false;
  }
  return true;
}

export type CheckoutInput = {
  userEmail: string;
  negotiationId: string;
  yearlySavingsCents: number;
  appUrl: string;
};

export type CheckoutSession = {
  id: string;
  url: string | null;
  amountCents: number;
  test: boolean;
};

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
  const amountCents = computeSuccessFeeCents(input.yearlySavingsCents);
  if (!apiKey || apiKey === "sk_test_dummy") {
    return {
      id: `cs_test_${input.negotiationId}`,
      url: `${input.appUrl}/pay/${input.negotiationId}?test=1`,
      amountCents,
      test: true,
    };
  }

  const session = await client().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["ideal", "card"],
    customer_email: input.userEmail,
    metadata: { negotiationId: input.negotiationId },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: "DeGeldHeld success-fee",
            description: `15% van jaarlijkse besparing (€${(input.yearlySavingsCents / 100).toFixed(2)})`,
          },
        },
      },
    ],
    success_url: `${input.appUrl}/pay/${input.negotiationId}?status=success`,
    cancel_url: `${input.appUrl}/pay/${input.negotiationId}?status=cancelled`,
  });

  return {
    id: session.id,
    url: session.url,
    amountCents,
    test: false,
  };
}

export type WebhookEvent = {
  type: string;
  negotiationId: string | null;
  billId: string | null;
  kind: "paywall" | "success-fee" | null;
  paymentIntentId: string | null;
  sessionId: string | null;
};

export function verifyAndParseWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string,
): { ok: true; event: WebhookEvent } | { ok: false; error: string } {
  if (!secret) return { ok: false, error: "no webhook secret configured" };
  try {
    const evt = client().webhooks.constructEvent(payload, signature, secret);
    const data = evt.data.object as unknown as Record<string, unknown>;
    const meta = (data.metadata as Record<string, string> | null) ?? null;
    const kindRaw = meta?.kind;
    return {
      ok: true,
      event: {
        type: evt.type,
        negotiationId: meta?.negotiationId ?? null,
        billId: meta?.billId ?? null,
        kind:
          kindRaw === "paywall" || kindRaw === "success-fee"
            ? kindRaw
            : meta?.billId
              ? "paywall"
              : meta?.negotiationId
                ? "success-fee"
                : null,
        paymentIntentId:
          (typeof data.payment_intent === "string" ? data.payment_intent : null) ??
          (typeof data.id === "string" && evt.type.startsWith("payment_intent.") ? data.id : null),
        sessionId: typeof data.id === "string" && evt.type.startsWith("checkout.") ? data.id : null,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function shouldMarkPaid(eventType: string): boolean {
  return eventType === "checkout.session.completed" || eventType === "payment_intent.succeeded";
}

export function shouldMarkRefunded(eventType: string): boolean {
  return eventType === "charge.refunded" || eventType === "charge.refund.updated";
}

export function shouldMarkFailed(eventType: string): boolean {
  return eventType === "payment_intent.payment_failed" || eventType === "checkout.session.expired";
}

// ---------- DEEL 10 paywall ----------

/**
 * Returns true when this Bill needs to be paid for before its
 * Negotiation can be analysed.
 *
 * Rules:
 *   - position 0 (first bill the user ever uploaded) is always free.
 *   - Subsequent bills require a paid Bill.paidAt.
 *   - If Bill.paidAt is already set, no further payment is required.
 */
export async function requiresPayment(
  userId: string,
  billId: string,
): Promise<boolean> {
  // Feature-flag escape hatch: setting FEATURE_PAYWALL_ENABLED=false in
  // Vercel disables the paywall site-wide without a code revert.
  if (process.env.FEATURE_PAYWALL_ENABLED === "false") return false;
  // v11: under no-cure-no-pay the analysis phase is always free. The
  // fee is only triggered after proofVerifiedAt is set + actual
  // savings >= the €50 threshold (see feeForVerifiedSavings).
  if (process.env.FEATURE_NO_CURE_NO_PAY === "true") return false;

  // Admin bypass — admins (per ADMIN_EMAILS env var) skip the paywall so we
  // can test the full flow end-to-end without paying ourselves. The paywall
  // remains active for everyone else.
  const adminList = (process.env.ADMIN_EMAILS ?? "").toLowerCase();
  if (adminList) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const adminEmails = adminList.split(",").map((e) => e.trim()).filter(Boolean);
    if (u?.email && adminEmails.includes(u.email.toLowerCase())) return false;
  }

  const bill = await prisma.bill.findFirst({
    where: { id: billId, userId },
    select: { position: true, paidAt: true },
  });
  if (!bill) return false; // unknown bill — let the calling page decide
  if (bill.position === 0) return false;
  if (bill.paidAt != null) return false;

  // v7: each successful referral grants 1 free bill. Count unused
  // referral-credits (rewardCents>0 + usedAt set) against the number
  // of paywall-eligible bills the user already used to skip the gate.
  const earned = await prisma.referral.count({
    where: { ownerId: userId, usedAt: { not: null }, rewardCents: { gt: 0 } },
  });
  if (earned > 0) {
    const consumed = await prisma.bill.count({
      where: { userId, position: { gt: 0 }, paidAt: null, id: { not: billId } },
    });
    // Referrals cover the *oldest* unpaid bills first — so if there are more
    // earned credits than already-consumed slots, the current bill is free.
    if (earned > consumed) return false;
  }
  return true;
}

export type PaywallCheckoutInput = {
  userEmail: string;
  billId: string;
  appUrl: string;
};

/**
 * Stripe Checkout session for the per-bill paywall flow.
 * Returns a test URL when no real Stripe key is configured (dev/CI).
 */
export async function createPaywallCheckoutSession(
  input: PaywallCheckoutInput,
): Promise<CheckoutSession> {
  const amountCents = PAYWALL_FEE_CENTS;
  if (!apiKey || apiKey === "sk_test_dummy") {
    return {
      id: `cs_paywall_${input.billId}`,
      url: `${input.appUrl}/pay/${input.billId}?test=1`,
      amountCents,
      test: true,
    };
  }

  const session = await client().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["ideal", "card"],
    customer_email: input.userEmail,
    metadata: { billId: input.billId, kind: "paywall" },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: "DeGeldHeld — extra onderhandeling",
            description: "Toegang tot AI-analyse en onderhandel-email voor deze rekening.",
          },
        },
      },
    ],
    success_url: `${input.appUrl}/onderhandel/analyse?bill=${input.billId}&paid=1`,
    cancel_url: `${input.appUrl}/pay/${input.billId}?status=cancelled`,
  });

  return { id: session.id, url: session.url, amountCents, test: false };
}
