import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import {
  isVolmachtClaimType,
  type VolmachtClaimType,
} from "@/lib/volmacht";
import { claimTypeLabel, type ClaimType } from "@/lib/admin-claims";
import VolmachtPaperFlow from "@/components/VolmachtPaperFlow";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Volmacht ondertekenen — DeGeldHeld",
  robots: { index: false, follow: false },
};

type Props = { params: { claimType: string; claimId: string } };

/**
 * v36 idee 2 — server-page voor de PAPIER-volmacht-flow.
 *
 * Huurcommissie + Geschillencommissie Energie eisen een schriftelijke
 * ondertekende machtiging (zie docs/MACHTIGING.md / juridische research).
 * Pure SES is niet voldoende. Flow:
 *   1. Klant ziet uitleg + zaak-identifier + scope-tekst
 *   2. Klant downloadt PDF-machtigingsformulier (voorgevuld)
 *   3. Klant print + ondertekent + scant
 *   4. Klant uploadt de scan via VolmachtPaperFlow
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
  const userName = (session.user as { name?: string | null }).name ?? "";
  const claimType = params.claimType as VolmachtClaimType;

  // Verifieer ownership van de claim + bouw korte omschrijving voor de header.
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

  // Bestaande volmacht-record (kan al een papieren scan hebben).
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
      signedDocumentUrl: true,
      signedDocumentFilename: true,
      signedDocumentUploadedAt: true,
      zaakIdentifier: true,
    },
  });

  const labelType = claimTypeLabel(claimType as ClaimType);
  const claimOmschrijving =
    "boekjaar" in claimOwner
      ? `boekjaar ${claimOwner.boekjaar}${claimOwner.verhuurderNaam ? ` @ ${claimOwner.verhuurderNaam}` : ""}`
      : `@ ${claimOwner.provider}`;

  const paperUploaded =
    !!existing &&
    !existing.revokedAt &&
    !!existing.signedDocumentUrl;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-32 pt-10 sm:pt-14">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Volmacht
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Onderteken je machtiging
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          {labelType} — {claimOmschrijving}
        </p>
      </header>

      <section
        data-testid="volmacht-explainer"
        className="mt-10 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Waarom op papier?
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          De Huurcommissie en de Geschillencommissie Energie accepteren alléén
          machtigingen die met de hand zijn ondertekend (digitale handtekeningen
          op SES-niveau zijn voor hen onvoldoende). Het kost je ongeveer 5 minuten
          en zorgt dat we je claim formeel kunnen voortzetten.
        </p>
        {!userName || userName.trim().length < 2 ? (
          <p className="mt-3 text-sm font-medium text-rose-700">
            We hebben geen volledige naam op je account. Vul 'm eerst in via{" "}
            <Link href="/account" className="underline">
              Mijn account
            </Link>{" "}
            voordat je de PDF downloadt — anders blijft je naam-veld leeg.
          </p>
        ) : null}
      </section>

      <div className="mt-8">
        <VolmachtPaperFlow
          claimType={claimType}
          claimId={params.claimId}
          alreadyUploaded={paperUploaded}
          signedDocumentFilename={existing?.signedDocumentFilename ?? null}
          signedDocumentUploadedAt={existing?.signedDocumentUploadedAt ?? null}
        />
      </div>

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/account/claims" className="underline">
          ← Terug naar mijn claims
        </Link>
      </div>
    </main>
  );
}
