/**
 * lib/admin-claims.ts — V36 DEEL 1 helpers voor /admin/claims.
 *
 * Pure (op één async fee-charge na) zodat de route + admin-page testbaar
 * blijft zonder Prisma in de tests aan te raken. Élke admin-actie wordt
 * geaudit in `AdminAction` — bewaartermijn 7 jaar (financiële administratie).
 */
import { computeBox3Fee } from "@/lib/box3-claim";
import { computeHuurFee } from "@/lib/huurcommissie";
import { computeEnergieFee } from "@/lib/energie-claim";

/** Drie ondersteunde claim-types — string-id matcht de Prisma-modelnaam. */
export type ClaimType = "Box3Claim" | "HuurServicekostenClaim" | "EnergieEindafrekeningClaim";

export const CLAIM_TYPES: ReadonlyArray<ClaimType> = [
  "Box3Claim",
  "HuurServicekostenClaim",
  "EnergieEindafrekeningClaim",
];

export function isClaimType(s: unknown): s is ClaimType {
  return typeof s === "string" && (CLAIM_TYPES as ReadonlyArray<string>).includes(s);
}

/**
 * Bereken de te-charge-fee voor een bepaalde claim. Pure functie.
 * Iedere type heeft zijn eigen drempel + percentage (zie lib/box3-claim,
 * lib/huurcommissie, lib/energie-claim). Werkelijk-bedrag onder de
 * type-drempel → fee € 0 (eerlijk, géén stille fee).
 */
export function feeForClaim(
  type: ClaimType,
  werkelijkeCents: number | null | undefined,
): number {
  if (typeof werkelijkeCents !== "number" || werkelijkeCents <= 0) return 0;
  switch (type) {
    case "Box3Claim":
      return computeBox3Fee(werkelijkeCents);
    case "HuurServicekostenClaim":
      return computeHuurFee(werkelijkeCents);
    case "EnergieEindafrekeningClaim":
      return computeEnergieFee(werkelijkeCents);
  }
}

/** Mensleesbaar label per claim-type voor de admin-UI. */
export function claimTypeLabel(type: ClaimType): string {
  switch (type) {
    case "Box3Claim":
      return "Box 3 — rechtsherstel";
    case "HuurServicekostenClaim":
      return "Huurcommissie — servicekosten";
    case "EnergieEindafrekeningClaim":
      return "Energie — eindafrekening";
  }
}

/** AdminAction-action-string per claim-type voor charge-events. */
export function chargeActionFor(type: ClaimType): "charge-box3" | "charge-huur" | "charge-energie" {
  switch (type) {
    case "Box3Claim":
      return "charge-box3";
    case "HuurServicekostenClaim":
      return "charge-huur";
    case "EnergieEindafrekeningClaim":
      return "charge-energie";
  }
}

/**
 * Validatie voor `POST /api/admin/claims/[type]/[id]/charge`. Pure.
 * Vereist: type ∈ CLAIM_TYPES; werkelijkeCents > 0; claim-status moet
 * geschikt zijn (UITSPRAAK voor huur/energie, PROOF_RECEIVED of UITSPRAAK
 * voor box3 — beide types accepteren we hier, de DB-update doet de
 * autoritatieve state-transition).
 */
export type AdminChargeValidationInput = {
  type: unknown;
  claimId: unknown;
};
export type AdminChargeValidation =
  | { ok: true; type: ClaimType; claimId: string }
  | { ok: false; reason: "invalid-type" | "invalid-claim-id" };

export function validateAdminChargeRequest(
  input: AdminChargeValidationInput,
): AdminChargeValidation {
  if (!isClaimType(input.type)) return { ok: false, reason: "invalid-type" };
  if (typeof input.claimId !== "string" || input.claimId.length === 0) {
    return { ok: false, reason: "invalid-claim-id" };
  }
  return { ok: true, type: input.type, claimId: input.claimId };
}
