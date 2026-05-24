import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { formatEurCents } from "@/lib/format";
import Box3ProofUpload from "./Box3ProofUpload";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Upload je Box 3-beschikking — DeGeldHeld",
  description:
    "Upload de Belastingdienst-beschikking. We lezen het toegekende bedrag " +
    "automatisch uit en schrijven de no-cure-no-pay fee af — eerlijke uitkomst.",
};

/** v30 DEEL 1 — owner-scoped proof-back upload pagina. */
export default async function Box3ProofPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  if (!isEnabled("BOX3_CHECK_ENABLED")) redirect("/");
  const session = await auth();
  const { claimId } = await params;
  if (!session?.user) redirect(`/login?from=/box3-check/proof/${claimId}`);
  const userId = (session.user as { id: string }).id;

  const claim = await prisma.box3Claim.findFirst({
    where: { id: claimId, userId },
  });
  if (!claim) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        Box 3 — proof-back
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
        Belastingjaar {claim.jaar} — claim {claim.id.slice(0, 8)}…
      </h1>
      <p className="mt-3 text-slate-600">
        Indicatieve verwachte teruggave:{" "}
        <strong>{formatEurCents(claim.verwachteTeruggaveCents)}</strong>. Werkelijk
        teruggehaalde bedrag bepaalt onze fee — onder € 500 = € 0.
      </p>

      <ClaimStateBlock claim={claim} />

      {claim.status === "AWAITING_PROOF" || claim.status === "INTENT" ? (
        <Box3ProofUpload claimId={claim.id} />
      ) : null}

      <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <strong className="font-semibold text-slate-900">AVG-grondslag:</strong>{" "}
        We slaan deze claim + de geüploade beschikking op zolang dat nodig is om
        de no-cure-no-pay-fee uit te voeren en onze administratie te
        verantwoorden. Grondslag: uitvoering van de overeenkomst (AVG art. 6 lid
        1b) + wettelijke bewaarplicht financiële administratie. Je kunt deze
        gegevens later in <Link href="/account" className="underline">je account</Link>
        {" "}terugvinden of verwijderen na afronding.
      </div>
    </main>
  );
}

function ClaimStateBlock({ claim }: { claim: { status: string; werkelijkTeruggaveCents: number | null; feeCents: number | null; failureReason: string | null } }) {
  if (claim.status === "CHARGED") {
    const werkelijk = claim.werkelijkTeruggaveCents ?? 0;
    const fee = claim.feeCents ?? 0;
    return (
      <section
        data-testid="box3-proof-charged"
        className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/40 p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">Klaar ✓</h2>
        <p className="mt-1 text-sm text-slate-700">
          Werkelijk teruggehaald:{" "}
          <strong>{formatEurCents(werkelijk)}</strong>. Onze fee:{" "}
          <strong>{fee > 0 ? `${formatEurCents(fee)} (25%)` : "€ 0 (werkelijk < € 500)"}</strong>
          .
        </p>
      </section>
    );
  }
  if (claim.status === "FAILED") {
    return (
      <section
        data-testid="box3-proof-failed"
        className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6"
      >
        <h2 className="text-lg font-semibold text-rose-900">
          We kunnen de beschikking niet automatisch uitlezen
        </h2>
        <p className="mt-1 text-sm text-rose-900">
          {claim.failureReason ?? "Onbekende fout."} Iemand van ons team neemt
          binnen 1-2 werkdagen contact op voor handmatige verificatie.
        </p>
      </section>
    );
  }
  if (claim.status === "PROOF_RECEIVED") {
    return (
      <section
        data-testid="box3-proof-received"
        className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"
      >
        <h2 className="text-lg font-semibold text-amber-900">
          Bewijs ontvangen — verwerking loopt
        </h2>
        <p className="mt-1 text-sm text-amber-900">
          We hebben je beschikking gelezen. De fee wordt nu automatisch
          afgeschreven; ververs de pagina over een minuut.
        </p>
      </section>
    );
  }
  // INTENT / AWAITING_PROOF
  return (
    <section
      data-testid="box3-proof-awaiting"
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Wachten op je Belastingdienst-beschikking
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Zodra de beschikking binnen is (MijnBelastingdienst → Documenten),
        upload je 'm hieronder. PDF, max 10 MB.
      </p>
    </section>
  );
}
