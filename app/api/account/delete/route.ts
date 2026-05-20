import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  confirm: z.literal("VERWIJDER MIJN ACCOUNT"),
});

/**
 * POST /api/account/delete — GDPR Article 17.
 *
 * Two-step confirmation: client must POST {confirm: "VERWIJDER MIJN ACCOUNT"}.
 *
 * We anonymise rather than hard-delete so the public /proof aggregates
 * (savings amounts + outcomes, no PII) stay stable. The transaction below
 * scrubs EVERY field that could identify the person, across every table
 * that hangs off the user — leaving only non-identifying numeric/outcome
 * data behind:
 *   - User           email→placeholder, name/image/verified/stripe ids cleared
 *   - Session        deleted (logs the user out everywhere)
 *   - Account        deleted (OAuth tokens)
 *   - Bill           customerNumber/rawOcr/anonymousEmail/plan/period cleared
 *   - Negotiation    emailSubject/emailBody/reasoning cleared
 *   - NegotiationRound provider/counter/OCR/analysis text cleared
 *   - OutcomeProof   storageUrl/verifierNote cleared
 *   - WhatsAppThread provider/our/user phone numbers cleared
 *   - WhatsAppMessage body/mediaUrl cleared
 *   - FraudFlag      free-text reasons cleared
 *   - WaitlistEntry  deleted (carries the raw email)
 *   - OcrTrainingSample userId/reviewerUserId unlinked (json already PII-free)
 *
 * Payments are kept (financial/tax record) — they hold no free-text PII,
 * only numeric amounts + Stripe ids + a now-anonymised user link.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vul exact 'VERWIJDER MIJN ACCOUNT' in om te bevestigen." },
      { status: 400 },
    );
  }

  const stamp = Date.now();
  const now = new Date();
  const byUser = { userId };
  const byNegotiation = { negotiation: { is: { userId } } };

  await prisma.$transaction([
    // --- the user record ---
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${stamp}-${userId.slice(0, 6)}@example.invalid`,
        name: null,
        image: null,
        emailVerified: null,
        deletedAt: now,
        notificationsEnabled: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
    }),
    prisma.session.deleteMany({ where: byUser }),
    prisma.account.deleteMany({ where: byUser }),

    // --- bills: keep provider + amounts for /proof, scrub the rest ---
    prisma.bill.updateMany({
      where: byUser,
      data: {
        deletedAt: now,
        customerNumber: null,
        rawOcr: null,
        anonymousEmail: null,
        plan: null,
        period: null,
      },
    }),

    // --- negotiations + their children ---
    prisma.negotiation.updateMany({
      where: byUser,
      data: { emailSubject: null, emailBody: null, reasoning: null },
    }),
    prisma.negotiationRound.updateMany({
      where: byNegotiation,
      data: {
        providerResponse: null,
        responseOcrText: null,
        analysisJson: null,
        counterSubject: null,
        counterBody: null,
        inboundReplyTo: null,
        inboundMessageId: null,
      },
    }),
    prisma.outcomeProof.updateMany({
      where: byNegotiation,
      data: { storageUrl: null, verifierNote: null },
    }),
    prisma.whatsAppThread.updateMany({
      where: byNegotiation,
      data: { providerNumber: "", ourNumber: "", userPhoneNumber: null },
    }),
    prisma.whatsAppMessage.updateMany({
      where: { thread: { is: { negotiation: { is: { userId } } } } },
      data: { body: "", mediaUrl: null },
    }),
    prisma.fraudFlag.updateMany({
      where: byUser,
      data: { reasons: "[verwijderd op verzoek gebruiker]" },
    }),

    // --- standalone PII tables ---
    prisma.waitlistEntry.deleteMany({ where: byUser }),
    prisma.ocrTrainingSample.updateMany({
      where: { userId },
      data: { userId: null },
    }),
    prisma.ocrTrainingSample.updateMany({
      where: { reviewerUserId: userId },
      data: { reviewerUserId: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
