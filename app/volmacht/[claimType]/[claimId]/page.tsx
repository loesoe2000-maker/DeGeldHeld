import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import {
  isVolmachtClaimType,
  volmachtMandateText,
  type VolmachtClaimType,
} from "@/lib/volmacht";
import { claimTypeLabel, type ClaimType } from "@/lib/admin-claims";
import VolmachtSignForm from "@/components/VolmachtSignForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Volmacht ondertekenen — DeGeldHeld",
  robots: { index: false, follow: false },
};

type Props = { params: { claimType: string; claimId: string } };

/**
 * v36 idee 2 — server-page voor de SES-volmacht. Toont de exacte mandaat-
 * tekst + naam-input + bevestiging-checkbox. Als er al een actieve volmacht
 * is, tonen we die status (datum + getypte naam) i.p.v. opnieuw signen.
 */
export default async function VolmachtPage({ params }: Props) {
  if (!isEnabled("VOLMACHT_SES_ENABLED")) notFound();
  if (!isVolmachtClaimType(params.claimType)) notFound();

  const session = await auth();
  if (!session?.user) {
    redirect(
      `/login?from=/volmacht/${params.claimType}/${encodeURIComponent(params.claimId)}`,
    );
  }
  const userId = (session.user as { id: string }).id;
  const claimType = params.claimType as VolmachtClaimType;

  // Verifieer ownership van de claim.
  const claimOwner =
    claimType === "HuurServicekostenClaim"
      ? await prisma.huurServicekostenClaim.findUnique({
          where: { id: params.claimId },
          select: { id: true, userId: true, boekjaar: true, verhuurderNaam: true },
        })
      : await prisma.energieEindafrekeningClaim.findUnique({
          where: { id: params.claimId },
          select: { id: true, userId: true, provider: true },
        });

  if (!claimOwner || claimOwner.userId !== userId) notFound();

  // Bestaande volmacht?
  const existing = await prisma.volmacht.findUnique({
    where: {
      claimType_claimId: { claimType, claimId: params.claimId },
    },
    select: {
      id: true,
      fullName: true,
      signedAt: true,
      revokedAt: true,
      templateVersion: true,
    },
  });

  const userName = (session.user as { name?: string | null }).name ?? "";
  // Voor de huidige mandaat-tekst tonen we een placeholder-naam; client-form
  // zal 'm live updaten zodra user iets typt.
  const previewText = volmachtMandateText(claimType, userName || "[je volledige naam]");

  const labelType = claimTypeLabel(claimType as ClaimType);

  // Korte claim-omschrijving voor de header.
  const claimOmschrijving =
    "boekjaar" in claimOwner
      ? `boekjaar ${claimOwner.boekjaar}${claimOwner.verhuurderNaam ? ` @ ${claimOwner.verhuurderNaam}` : ""}`
      : `@ ${claimOwner.provider}`;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-32 pt-10 sm:pt-14">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Volmacht
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Ondertekenen voor je claim
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          {labelType} — {claimOmschrijving}
        </p>
      </header>

      {existing && !existing.revokedAt ? (
        <section
          data-testid="volmacht-existing"
          className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6"
        >
          <h2 className="text-lg font-semibold text-emerald-900">
            Volmacht is al ondertekend
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            Ondertekend door <strong>{existing.fullName}</strong> op{" "}
            {existing.signedAt.toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Template-versie: {existing.templateVersion}.
          </p>
          <p className="mt-3 text-sm text-emerald-800">
            Wil je deze volmacht intrekken? Stuur ons een bericht via{" "}
            <a className="underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>{" "}
            — wij zetten een revoke-stempel binnen 24u.
          </p>
        </section>
      ) : (
        <>
          <section
            data-testid="volmacht-template"
            className="mt-10 rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Wat je ondertekent
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {previewText}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Dit is een Simple Electronic Signature (SES, eIDAS-laagste
              niveau). Voldoende voor correspondentie met je verhuurder of
              energieleverancier; voor de Belastingdienst is DigiD vereist.
            </p>
          </section>

          <section className="mt-6">
            <VolmachtSignForm
              claimType={claimType}
              claimId={params.claimId}
              defaultFullName={userName}
            />
          </section>
        </>
      )}

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/account/claims" className="underline">
          ← Terug naar mijn claims
        </Link>
      </div>
    </main>
  );
}
