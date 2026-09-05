import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { generateEmail } from "@/lib/negotiator";
import { buildComparison } from "@/lib/comparison";
import { isSupportedCategory } from "@/lib/market-coverage";
import { negotiatorCache, cacheKey } from "@/lib/llm_cache";
import RelayConsentPrompt from "@/components/RelayConsentPrompt";
import { relayStatusLabel, relayMandateText } from "@/lib/relay";
import { relayProviderEmail, relayProviderChannel, relayNoEmailNote } from "@/lib/relay-providers";
import { isEnabled } from "@/lib/feature-flags";
import TrackEvent from "@/components/TrackEvent";
import EmailDisplay from "@/components/EmailDisplay";
import { reconcileFeeSetupFromSession } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onderhandel-email — DeGeldHeld" };

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string; card?: string; session_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const params = await searchParams;
  const billId = params.bill;
  if (!billId) redirect("/onderhandel");

  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) redirect("/onderhandel");

  // v25: returning from the card-link setup-checkout (card=ok&session_id=…).
  // Reconcile the card directly with Stripe so the unlock is immediate and
  // never has to wait for the async webhook (or for it to be subscribed).
  // Owner-scoped + idempotent; a no-op in test-dummy mode.
  if (params.card === "ok" && params.session_id) {
    await reconcileFeeSetupFromSession(params.session_id, userId);
  }

  // v41: geen kaart meer nodig — alles is gratis.
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { feePaymentMethodId: true },
  });

  // v22 AFM gate: never generate a negotiation for hypotheek/verzekering —
  // route back to the analyse page which shows the "not supported" state.
  if (!isSupportedCategory(bill.category)) {
    redirect(`/onderhandel/analyse?bill=${bill.id}`);
  }

  const comparison = buildComparison({
    provider: bill.provider,
    category: bill.category,
    amountCents: bill.amountCents,
    country: (bill.country as import("@/lib/providers").Country | null) ?? "NL",
  });

  // v4: use monthlyCents (vast abonnement) ipv amountCents (totaal) zodat
  // negotiator vergelijkt op het terugkerend bedrag, niet eenmalige posten.
  const compareCents = bill.monthlyCents ?? bill.amountCents;

  const key = cacheKey(["negotiator", bill.id, compareCents, "v4"]);
  let result = negotiatorCache.get(key) as Awaited<ReturnType<typeof generateEmail>> | null;
  if (!result) {
    result = await generateEmail({
      customerName: session.user.name ?? session.user.email ?? "Klant",
      customerEmail: session.user.email ?? undefined,
      provider: bill.provider,
      category: bill.category,
      currentPlan: bill.plan,
      currentMonthlyCents: compareCents,
      customerNumber: bill.customerNumber,
      alternatives: comparison.topAlternatives,
    });
    negotiatorCache.set(key, result);
  }

  // Persist to negotiation
  const negotiation = await prisma.negotiation.upsert({
    where: { billId: bill.id },
    update: {
      state: "EMAIL_GEN",
      emailSubject: result.subject,
      emailBody: result.body,
      strategy: result.strategy,
      expectedSavingsCents: result.expectedSavingsCents,
      confidence: result.confidence,
      reasoning: result.reasoning,
    },
    create: {
      userId,
      billId: bill.id,
      state: "EMAIL_GEN",
      emailSubject: result.subject,
      emailBody: result.body,
      strategy: result.strategy,
      expectedSavingsCents: result.expectedSavingsCents,
      confidence: result.confidence,
      reasoning: result.reasoning,
    },
    select: { id: true, relayAuthorizedAt: true, relayState: true },
  });
  const relayAuthorized = !!negotiation.relayAuthorizedAt;

  // v41 — GRATIS PLATFORM: de mail werd tot v40 als 220-teken-teaser naar de
  // browser gestuurd zolang er geen betaalkaart gekoppeld was. Dat is weg —
  // iedereen krijgt de volledige tekst.

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <TrackEvent event="email_generated" props={{ category: bill.category }} />
      {params.card === "ok" && <TrackEvent event="fee_card_linked" />}
      <h1 className="text-3xl font-bold text-slate-900">Onderhandel-email</h1>
      <p className="mt-2 text-slate-600">
        Kopieer de tekst hieronder en stuur via je eigen e-mailadres naar je
        provider.
      </p>
      {/* ph-no-capture: the email body/teaser contains the customer's name +
          negotiation content — never let autocapture/heatmaps grab it. */}
      <div className="mt-8 ph-no-capture">
                  <EmailDisplay
            subject={result.subject}
            body={result.body}
            reasoning={result.reasoning}
            expectedSavingsCents={result.expectedSavingsCents}
            confidence={result.confidence}
            strategy={result.strategy}
            tonality={result.tonality}
            language={result.language}
            billId={bill.id}
            negotiationId={negotiation.id}
          />

      </div>

      {/* GUARDRAIL 7 — relay UI only exists behind the flag. Off → the manual
          copy-to-send flow above is the entire experience, no relay UI. */}
      {isEnabled("RELAY_ENABLED") &&
        (relayAuthorized ? (
          <section
            data-testid="relay-active"
            className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5"
          >
            <h2 className="text-lg font-semibold text-brand-900">
              {relayStatusLabel(negotiation.relayState)}
            </h2>
            <p className="mt-1 text-sm text-brand-900">
              DeGeldHeld onderhandelt namens jou met {bill.provider}. Je keurt elke
              deal zelf goed.{" "}
              <a href={`/onderhandel/${bill.id}/relay`} className="underline">
                Bekijk de status &amp; gesprekken →
              </a>
            </p>
          </section>
        ) : (
          <RelayConsentPrompt
            negotiationId={negotiation.id}
            provider={bill.provider}
            resolvedProviderEmail={relayProviderEmail(bill.provider)}
            channel={relayProviderChannel(bill.provider)}
            noEmailNote={relayNoEmailNote(bill.provider)}
            mandateText={relayMandateText(bill.provider)}
            returnTo={`/onderhandel/email?bill=${bill.id}`}
          />
        ))}
    </main>
  );
}
