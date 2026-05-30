/**
 * lib/claim-proof-storage.ts — v37 — bewijs-opslag voor claims.
 *
 * Eén plek waar het bewijs-document (Box 3-beschikking, Huurcommissie-
 * uitspraak, Geschillencommissie-uitspraak) naar Vercel Blob (private) gaat.
 * Vóór v37 lazen de upload-routes het bestand wel maar bewaarden het NIET —
 * de `*StorageUrl`-velden bleven leeg. Dit dicht die gap voor alle 3 de
 * claim-types tegelijk.
 *
 * Privacy: blob is `access: "private"`, alleen via een auth/admin-gated
 * proxy te downloaden. Bewaartermijn = 7 jaar (financiële administratie).
 *
 * De pad-bouw is een pure functie (getest); de feitelijke `put` zit in
 * uploadClaimProof en is best-effort (gooit niet door naar de caller — een
 * mislukte opslag mag de claim-/charge-flow nooit blokkeren).
 */

import { put } from "@vercel/blob";
import * as Sentry from "@sentry/nextjs";

export type ProofClaimType =
  | "Box3Claim"
  | "HuurServicekostenClaim"
  | "EnergieEindafrekeningClaim";

/**
 * Bouw een Blob-pad voor een bewijs-document. Pure functie → testbaar.
 * Strip path-separators + parent-refs (defense in depth; Vercel escapet ook).
 */
export function buildProofBlobPath(
  claimType: ProofClaimType,
  userId: string,
  claimId: string,
  filename: string,
  nowMs: number,
): string {
  const safeName = filename
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "__")
    .slice(0, 200);
  return `claim-proofs/${claimType}/${userId}/${claimId}/${nowMs}-${safeName}`;
}

/**
 * Upload een bewijs-bestand naar Vercel Blob (private). Best-effort:
 * geeft de storage-URL terug bij succes, of `null` bij elke fout (zodat de
 * caller gewoon doorgaat — de claim-flow mag niet stuk op opslag).
 */
export async function uploadClaimProof(opts: {
  claimType: ProofClaimType;
  userId: string;
  claimId: string;
  file: File | Buffer;
  filename: string;
  contentType?: string;
}): Promise<string | null> {
  try {
    const path = buildProofBlobPath(
      opts.claimType,
      opts.userId,
      opts.claimId,
      opts.filename,
      Date.now(),
    );
    const blob = await put(path, opts.file, {
      access: "private",
      contentType: opts.contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { module: "claim-proof-storage", claimType: opts.claimType },
    });
    return null;
  }
}
