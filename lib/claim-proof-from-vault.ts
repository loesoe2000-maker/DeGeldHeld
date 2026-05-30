/**
 * lib/claim-proof-from-vault.ts — v37 idee 1 — document-hergebruik.
 *
 * Laat een klant een bestaand document uit zijn kluis (UserDocument) kiezen
 * als bewijs bij een claim, i.p.v. opnieuw te uploaden. De blob wordt
 * GEKOPIEERD naar de claim-proofs-namespace (niet ge-refereerd) zodat een
 * latere verwijdering uit de kluis het claim-bewijs niet sloopt.
 *
 * SERVER-ONLY: gebruikt @vercel/blob copy. De ownership-check zit erin —
 * een klant kan alleen z'n eigen kluis-documenten koppelen.
 */

import { copy } from "@vercel/blob";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { buildProofBlobPath, type ProofClaimType } from "@/lib/claim-proof-storage";

export type AttachResult =
  | { ok: true; storageUrl: string; filename: string }
  | { ok: false; error: string };

/**
 * Kopieer een kluis-document als bewijs voor een claim.
 * Stappen: ownership-check (document hoort bij user) → blob copy → nieuwe
 * private storage-URL terug. Faalt netjes met een error-string.
 */
export async function attachVaultDocAsProof(opts: {
  documentId: string;
  userId: string;
  claimType: ProofClaimType;
  claimId: string;
}): Promise<AttachResult> {
  const doc = await prisma.userDocument.findUnique({
    where: { id: opts.documentId },
    select: { id: true, userId: true, storageUrl: true, filename: true },
  });
  if (!doc || doc.userId !== opts.userId) {
    // 'Niet gevonden' i.p.v. 'geen toegang' — bestaan van andermans id niet
    // bevestigen.
    return { ok: false, error: "Document niet gevonden in je kluis." };
  }

  const toPath = buildProofBlobPath(
    opts.claimType,
    opts.userId,
    opts.claimId,
    doc.filename,
    Date.now(),
  );

  try {
    const copied = await copy(doc.storageUrl, toPath, {
      access: "private",
      addRandomSuffix: true,
    });
    return { ok: true, storageUrl: copied.url, filename: doc.filename };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { module: "claim-proof-from-vault", claimType: opts.claimType },
    });
    return { ok: false, error: "Kopiëren uit je kluis mislukte. Probeer opnieuw." };
  }
}
