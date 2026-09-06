/**
 * POST /api/fee-setup — start a hosted Stripe Checkout (mode: setup) so the
 * user can attach a card for the no-cure-no-pay fee (€0 now). Auth required.
 *
 * Body (optional): { returnTo?: string } — where to send the user back to
 * (defaults to the email-generation step). On success Stripe redirects to
 * returnTo?card=ok; the webhook persists the card + mandate.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { detachFeePaymentMethod } from "@/lib/payments";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

function safeReturnTo(raw: unknown): string {
  // Only allow same-site relative paths (no open redirect).
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // v41 — GRATIS PLATFORM: hier werd een Stripe SetupIntent gestart om een
  // doorlopend incasso-mandaat op de kaart van de gebruiker vast te leggen.
  // Er valt niets meer te incasseren, dus dat mandaat mag niet meer ontstaan.
  // DELETE hieronder blijft WEL bestaan: bestaande mandaten moeten
  // ingetrokken kunnen worden.
  return NextResponse.json(
    {
      error: "Gone",
      reason: "fee-disabled",
      uitleg:
        "DeGeldHeld brengt geen kosten in rekening; een betaalmandaat is niet " +
        "meer nodig. Een bestaand mandaat kun je intrekken via DELETE.",
    },
    { status: 410 },
  );
}

/**
 * DELETE /api/fee-setup — withdraw the no-cure-no-pay mandate: detach the
 * card at Stripe + clear the saved payment method + mandate (consumer right
 * to revoke). Existing already-charged fees are unaffected.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { feePaymentMethodId: true },
  });
  if (user?.feePaymentMethodId) {
    await detachFeePaymentMethod(user.feePaymentMethodId);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { feePaymentMethodId: null, feeMandateAcceptedAt: null },
  });
  return NextResponse.json({ ok: true });
}
