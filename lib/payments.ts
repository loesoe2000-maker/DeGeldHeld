/**
 * Stripe billing — success-fee model.
 * Charge 15% of jaarbesparing op SUCCESS state.
 */

import Stripe from "stripe";

const SUCCESS_FEE_PCT = 0.15;
const MIN_BILL_CENTS = 500; // €5,00 minimum

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
    const data = evt.data.object as Record<string, unknown>;
    return {
      ok: true,
      event: {
        type: evt.type,
        negotiationId: ((data.metadata as Record<string, string> | null)?.negotiationId) ?? null,
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
