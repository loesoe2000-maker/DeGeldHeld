import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { formatEurCents } from "@/lib/format";
import EnergieUitspraakUpload from "./EnergieUitspraakUpload";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Upload Geschillencommissie-uitspraak — DeGeldHeld",
  description:
    "Upload de uitspraak / leverancier-bevestiging en geef het werkelijk " +
    "teruggehaalde bedrag op. Owner verwerkt de fee handmatig.",
};

/** v35 DEEL 2 — owner-scoped uitspraak-upload pagina (energie-claim). */
export default async function EnergieUitspraakPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  if (!isEnabled("ENERGIE_CLAIM_CHECK_ENABLED")) redirect("/");
  const session = await auth();
  const { claimId } = await params;
  if (!session?.user) redirect(`/login?from=/energie-claim-check/proof/${claimId}`);
  const userId = (session.user as { id: string }).id;

  const claim = await prisma.energieEindafrekeningClaim.findFirst({
    where: { id: claimId, userId },
  });
  if (!claim) notFound();

  // v37 — kluis-documenten aanbieden als alternatief voor opnieuw uploaden.
  const vaultDocs = isEnabled("DOCUMENTS_VAULT_ENABLED")
    ? await prisma.userDocument.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, filename: true, createdAt: true },
      })
    : [];
  const vaultDocsProp = vaultDocs.map((d) => ({
    id: d.id,
    kind: d.kind,
    filename: d.filename,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        Energie-claim — proof-back
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
        {claim.provider} — claim {claim.id.slice(0, 8)}…
      </h1>
      <p className="mt-3 text-slate-600">
        Indicatieve verwachte restitutie:{" "}
        <strong>{formatEurCents(claim.verwachteRestitutieCents)}</strong>. Werkelijk
        teruggehaalde bedrag leggen we vast voor ons track record.
      </p>

      <ClaimStateBlock claim={claim} />

      {claim.status === "INTENT" ||
      claim.status === "KLACHT_GESTUURD" ||
      claim.status === "GESCHILLENCOMMISSIE_INGEDIEND" ? (
        <EnergieUitspraakUpload claimId={claim.id} vaultDocs={vaultDocsProp} />
      ) : null}

      <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <strong className="font-semibold text-slate-900">AVG-grondslag:</strong>{" "}
        We slaan deze claim + de geüploade uitspraak op zolang dat nodig is om
        onze administratie te verantwoorden.
        Grondslag: uitvoering van de overeenkomst (AVG art. 6 lid 1b) +
        wettelijke bewaarplicht financiële administratie. Je kunt deze gegevens
        later in <Link href="/account" className="underline">je account</Link>
        {" "}terugvinden of verwijderen na afronding.
      </div>
    </main>
  );
}

function ClaimStateBlock({
  claim,
}: {
  claim: {
    status: string;
    werkelijkeRestitutieCents: number | null;
    feeCents: number | null;
    failureReason: string | null;
  };
}) {
  if (claim.status === "CHARGED") {
    const werkelijk = claim.werkelijkeRestitutieCents ?? 0;
    const fee = claim.feeCents ?? 0;
    return (
      <section
        data-testid="energie-proof-charged"
        className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/40 p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">Klaar ✓</h2>
        <p className="mt-1 text-sm text-slate-700">
          Werkelijk teruggehaald:{" "}
          <strong>{formatEurCents(werkelijk)}</strong>. Kosten voor jou:{" "}
          <strong>{fee > 0 ? `${formatEurCents(fee)} (20%)` : "€ 0 (werkelijk < € 50)"}</strong>.
        </p>
      </section>
    );
  }
  if (claim.status === "FAILED") {
    return (
      <section
        data-testid="energie-proof-failed"
        className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6"
      >
        <h2 className="text-lg font-semibold text-rose-900">
          Claim afgesloten zonder uitkering
        </h2>
        <p className="mt-1 text-sm text-rose-900">
          {claim.failureReason ??
            "Geschillencommissie Energie heeft je klacht afgewezen of het traject is gestopt."}
        </p>
      </section>
    );
  }
  if (claim.status === "UITSPRAAK") {
    // v37 — een afwijzing (€ 0) is geen "review nodig" maar een nette
    // afsluiting: fee € 0, klant hoeft niets te doen.
    const isAfwijzing = claim.werkelijkeRestitutieCents === 0;
    return (
      <section
        data-testid="energie-proof-received"
        className={`mt-6 rounded-2xl border p-6 ${
          isAfwijzing ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"
        }`}
      >
        <h2
          className={`text-lg font-semibold ${
            isAfwijzing ? "text-slate-900" : "text-amber-900"
          }`}
        >
          {isAfwijzing
            ? "Afwijzing ontvangen — fee € 0"
            : "Uitspraak ontvangen — handmatige review"}
        </h2>
        <p
          className={`mt-1 text-sm ${
            isAfwijzing ? "text-slate-700" : "text-amber-900"
          }`}
        >
          {isAfwijzing
            ? "De Geschillencommissie/leverancier kende geen restitutie toe. " +
              "Dit kost je niets. Wij sluiten je claim verder " +
              "netjes af — je hoeft niets meer te doen."
            : "We hebben je uitspraak ontvangen. Iemand van ons reviewt 'm en " +
              "rondt je claim binnen 1-2 werkdagen af (" +
              "áls werkelijk teruggehaald ≥ € 50)."}
        </p>
      </section>
    );
  }
  return (
    <section
      data-testid="energie-proof-awaiting"
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Wachten op de Geschillencommissie-uitspraak
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Zodra je leverancier of Geschillencommissie Energie de uitspraak heeft
        gestuurd, upload je 'm hieronder + vul je het werkelijk teruggehaalde
        bedrag in. PDF, max 10 MB.
      </p>
    </section>
  );
}
