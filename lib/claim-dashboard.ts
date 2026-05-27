/**
 * lib/claim-dashboard.ts — v36 idee 1 — Claim-dashboard data-laag.
 *
 * Pure mappers per claim-type + één async aggregator. De pure mappers
 * worden volledig getest zonder Prisma; de aggregator krijgt zijn DB
 * via parameter (testbaar via mock-prisma).
 *
 * Géén verzonnen deadlines: waar we géén timestamp-anchor hebben (bv.
 * "wanneer is de bezwaarbrief écht verstuurd?") geven we tekstuele
 * verwachtingen ("wacht op reactie — max 21 dagen") zonder concrete
 * datum. Eerlijk > precies.
 */

import type { ClaimType } from "@/lib/admin-claims";
import { claimTypeLabel } from "@/lib/admin-claims";

// ─── Input-shape per claim (subset van Prisma-rows) ─────────────────────────

export type Box3ClaimRow = {
  id: string;
  jaar: number;
  verwachteTeruggaveCents: number;
  werkelijkTeruggaveCents: number | null;
  status: string;
  proofStorageUrl: string | null;
  proofUploadedAt: Date | null;
  chargedAt: Date | null;
  feeCents: number | null;
  createdAt: Date;
};

export type HuurClaimRow = {
  id: string;
  boekjaar: number;
  verhuurderNaam: string | null;
  verwachteRestitutieCents: number;
  werkelijkeRestitutieCents: number | null;
  status: string;
  uitspraakStorageUrl: string | null;
  uitspraakUploadedAt: Date | null;
  chargedAt: Date | null;
  feeCents: number | null;
  createdAt: Date;
};

export type EnergieClaimRow = {
  id: string;
  provider: string;
  verwachteRestitutieCents: number;
  werkelijkeRestitutieCents: number | null;
  status: string;
  uitspraakStorageUrl: string | null;
  uitspraakUploadedAt: Date | null;
  chargedAt: Date | null;
  feeCents: number | null;
  createdAt: Date;
};

// ─── Output-shape ──────────────────────────────────────────────────────────

export type DashboardClaim = {
  type: ClaimType;
  id: string;
  /** Korte titel, bv "Box 3 — belastingjaar 2023" */
  titel: string;
  /** Raw status uit DB (voor data-attributes / debugging). */
  statusCode: string;
  /** NL-readable status-label. */
  statusLabel: string;
  /** Wat moet user nu doen / waarop wachten? Tekstueel, geen verzonnen datums. */
  nextStep: string;
  /** Closed = terminal status (CHARGED of FAILED). */
  closed: boolean;
  verwachteRestitutieCents: number;
  werkelijkeRestitutieCents: number | null;
  feeCents: number | null;
  /** Heeft user al een bewijsdocument geüpload? */
  hasUploadedDoc: boolean;
  chargedAt: Date | null;
  createdAt: Date;
  /**
   * v36 idee 2 — SES-volmacht. Box 3-claims ondersteunen GEEN SES (DigiD
   * vereist via Belastingdienst), dus supportsVolmacht=false. Voor huur +
   * energie is supportsVolmacht=true en geeft `hasVolmacht` aan of er al
   * een actieve volmacht ligt.
   */
  supportsVolmacht: boolean;
  hasVolmacht: boolean;
  volmachtSignedAt: Date | null;
};

/**
 * Subset van Volmacht-row dat de mappers nodig hebben. Letterlijk uit
 * Prisma-row te halen — schept geen extra DB-roundtrip.
 *
 * v36 papier-flow: alleen volmachten met een geüploade ondertekende
 * scan (`signedDocumentUrl`) tellen als juridisch geldig — pure SES-
 * consent zonder papier is voor Huurcommissie/Geschillencommissie niet
 * voldoende (zie docs/MACHTIGING.md / juridische research).
 */
export type VolmachtIndexRow = {
  claimType: string;
  claimId: string;
  signedAt: Date;
  revokedAt: Date | null;
  signedDocumentUrl: string | null;
  signedDocumentUploadedAt: Date | null;
};

/**
 * Bouw een lookup-map: `${claimType}:${claimId}` → upload-datum van de
 * ondertekende papier-volmacht. Alleen geüploade + niet-gerevoceerde
 * volmachten worden opgenomen.
 */
function buildVolmachtMap(rows: ReadonlyArray<VolmachtIndexRow>): Map<string, Date> {
  const m = new Map<string, Date>();
  for (const v of rows) {
    if (v.revokedAt) continue;
    if (!v.signedDocumentUrl) continue;
    m.set(
      `${v.claimType}:${v.claimId}`,
      v.signedDocumentUploadedAt ?? v.signedAt,
    );
  }
  return m;
}

// ─── Status-tekst per claim-type ────────────────────────────────────────────

const BOX3_STATUS: Record<string, { label: string; next: string }> = {
  INTENT: {
    label: "Bezwaar klaar — nog niet ingediend",
    next:
      "Verstuur de pre-gefilde bezwaarbrief naar de Belastingdienst (per " +
      "post of via Mijn Belastingdienst).",
  },
  AWAITING_PROOF: {
    label: "Bezwaar ingediend bij Belastingdienst",
    next:
      "Wacht op de beschikking van de Belastingdienst. Dit kan 6 maanden " +
      "of langer duren. Zodra de beschikking binnen is: upload de PDF, " +
      "dan verrekenen wij de fee.",
  },
  PROOF_RECEIVED: {
    label: "Beschikking ontvangen",
    next:
      "Fee wordt verrekend op basis van het werkelijke teruggave-bedrag. " +
      "Je krijgt een bevestiging zodra Stripe de betaling heeft verwerkt.",
  },
  CHARGED: {
    label: "Afgerond — restitutie + fee verrekend",
    next: "Klaar. Bewaar de beschikking + factuur voor je administratie.",
  },
  FAILED: {
    label: "Niet gelukt",
    next:
      "Geen fee verschuldigd (no cure, no pay). Reden staat op je " +
      "claim-detail; je kunt opnieuw indienen als de situatie wijzigt.",
  },
};

const HUUR_STATUS: Record<string, { label: string; next: string }> = {
  INTENT: {
    label: "Bezwaarbrief klaar — nog niet verstuurd",
    next: "Verstuur de bezwaarbrief naar je verhuurder (per post + e-mail).",
  },
  BEZWAAR_GESTUURD: {
    label: "Bezwaar naar verhuurder verstuurd",
    next:
      "Wacht op reactie van je verhuurder (max 21 dagen wettelijk). Geen " +
      "reactie of afwijzing? Dan dienen we de zaak bij de Huurcommissie in.",
  },
  HUURCOMMISSIE_INGEDIEND: {
    label: "Zaak bij Huurcommissie ingediend",
    next:
      "Uitspraak duurt gemiddeld 5 maanden. Zodra de uitspraak binnen is: " +
      "upload het PDF zodat we de restitutie kunnen volgen.",
  },
  UITSPRAAK: {
    label: "Uitspraak ontvangen",
    next:
      "Verhuurder verrekent de restitutie via de servicekosten of een " +
      "directe terugbetaling. Daarna verrekenen wij de fee (20% NCNP).",
  },
  CHARGED: {
    label: "Afgerond — restitutie + fee verrekend",
    next: "Klaar. Bewaar de uitspraak + factuur voor je administratie.",
  },
  FAILED: {
    label: "Niet gelukt",
    next:
      "Geen fee verschuldigd (no cure, no pay). Je kunt opnieuw bezwaar " +
      "maken bij een volgende jaarafrekening.",
  },
};

const ENERGIE_STATUS: Record<string, { label: string; next: string }> = {
  INTENT: {
    label: "Klachtbrief klaar — nog niet verstuurd",
    next:
      "Verstuur de klachtbrief naar je energieleverancier (mail + " +
      "aangetekend per post).",
  },
  KLACHT_GESTUURD: {
    label: "Klacht naar leverancier verstuurd",
    next:
      "Wacht op reactie (max 30 dagen volgens Algemene Voorwaarden " +
      "Energie). Geen reactie of afwijzing? Dan stappen we naar de " +
      "Geschillencommissie Energie.",
  },
  GESCHILLENCOMMISSIE_INGEDIEND: {
    label: "Zaak bij Geschillencommissie Energie ingediend",
    next:
      "Behandeling duurt gemiddeld 3 maanden. Zodra de uitspraak binnen " +
      "is: upload het PDF.",
  },
  UITSPRAAK: {
    label: "Uitspraak ontvangen",
    next:
      "Leverancier verrekent het bedrag via je volgende factuur of een " +
      "directe terugbetaling. Daarna verrekenen wij de fee (20% NCNP).",
  },
  CHARGED: {
    label: "Afgerond — restitutie + fee verrekend",
    next: "Klaar. Bewaar de uitspraak + factuur voor je administratie.",
  },
  FAILED: {
    label: "Niet gelukt",
    next:
      "Geen fee verschuldigd (no cure, no pay). Je kunt opnieuw klagen " +
      "bij een volgende eindafrekening die afwijkt.",
  },
};

function statusText(
  table: Record<string, { label: string; next: string }>,
  code: string,
): { label: string; next: string } {
  return (
    table[code] ?? {
      label: code,
      next: "Status onbekend — neem contact op via hallo@degeldheld.com.",
    }
  );
}

function isClosed(statusCode: string): boolean {
  return statusCode === "CHARGED" || statusCode === "FAILED";
}

// ─── Pure mappers ───────────────────────────────────────────────────────────

export function mapBox3Claim(c: Box3ClaimRow): DashboardClaim {
  const st = statusText(BOX3_STATUS, c.status);
  return {
    type: "Box3Claim",
    id: c.id,
    titel: `${claimTypeLabel("Box3Claim")} — belastingjaar ${c.jaar}`,
    statusCode: c.status,
    statusLabel: st.label,
    nextStep: st.next,
    closed: isClosed(c.status),
    verwachteRestitutieCents: c.verwachteTeruggaveCents,
    werkelijkeRestitutieCents: c.werkelijkTeruggaveCents,
    feeCents: c.feeCents,
    hasUploadedDoc: c.proofStorageUrl != null,
    chargedAt: c.chargedAt,
    createdAt: c.createdAt,
    // Box 3 → Belastingdienst-flow vereist DigiD, géén SES.
    supportsVolmacht: false,
    hasVolmacht: false,
    volmachtSignedAt: null,
  };
}

export function mapHuurClaim(
  c: HuurClaimRow,
  volmachtMap?: Map<string, Date>,
): DashboardClaim {
  const st = statusText(HUUR_STATUS, c.status);
  const verhuurderSuf = c.verhuurderNaam ? ` @ ${c.verhuurderNaam}` : "";
  const signedAt =
    volmachtMap?.get(`HuurServicekostenClaim:${c.id}`) ?? null;
  return {
    type: "HuurServicekostenClaim",
    id: c.id,
    titel: `${claimTypeLabel("HuurServicekostenClaim")} — boekjaar ${c.boekjaar}${verhuurderSuf}`,
    statusCode: c.status,
    statusLabel: st.label,
    nextStep: st.next,
    closed: isClosed(c.status),
    verwachteRestitutieCents: c.verwachteRestitutieCents,
    werkelijkeRestitutieCents: c.werkelijkeRestitutieCents,
    feeCents: c.feeCents,
    hasUploadedDoc: c.uitspraakStorageUrl != null,
    chargedAt: c.chargedAt,
    createdAt: c.createdAt,
    supportsVolmacht: true,
    hasVolmacht: signedAt != null,
    volmachtSignedAt: signedAt,
  };
}

export function mapEnergieClaim(
  c: EnergieClaimRow,
  volmachtMap?: Map<string, Date>,
): DashboardClaim {
  const st = statusText(ENERGIE_STATUS, c.status);
  const signedAt =
    volmachtMap?.get(`EnergieEindafrekeningClaim:${c.id}`) ?? null;
  return {
    type: "EnergieEindafrekeningClaim",
    id: c.id,
    titel: `${claimTypeLabel("EnergieEindafrekeningClaim")} — ${c.provider}`,
    statusCode: c.status,
    statusLabel: st.label,
    nextStep: st.next,
    closed: isClosed(c.status),
    verwachteRestitutieCents: c.verwachteRestitutieCents,
    werkelijkeRestitutieCents: c.werkelijkeRestitutieCents,
    feeCents: c.feeCents,
    hasUploadedDoc: c.uitspraakStorageUrl != null,
    chargedAt: c.chargedAt,
    createdAt: c.createdAt,
    supportsVolmacht: true,
    hasVolmacht: signedAt != null,
    volmachtSignedAt: signedAt,
  };
}

// ─── Async aggregator ───────────────────────────────────────────────────────

export type ClaimDashboardDb = {
  box3Claim: { findMany(args: unknown): Promise<Box3ClaimRow[]> };
  huurServicekostenClaim: { findMany(args: unknown): Promise<HuurClaimRow[]> };
  energieEindafrekeningClaim: { findMany(args: unknown): Promise<EnergieClaimRow[]> };
  volmacht: { findMany(args: unknown): Promise<VolmachtIndexRow[]> };
};

/**
 * Aggregeer álle claims voor één user in unified shape. Sorteert: open eerst,
 * daarna closed; binnen elke groep nieuwste eerst.
 */
export async function getUserClaims(
  userId: string,
  db: ClaimDashboardDb,
): Promise<DashboardClaim[]> {
  const [box3, huur, energie, volmachten] = await Promise.all([
    db.box3Claim.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }) as Promise<Box3ClaimRow[]>,
    db.huurServicekostenClaim.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }) as Promise<HuurClaimRow[]>,
    db.energieEindafrekeningClaim.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }) as Promise<EnergieClaimRow[]>,
    db.volmacht.findMany({
      where: { userId },
      select: {
        claimType: true,
        claimId: true,
        signedAt: true,
        revokedAt: true,
        signedDocumentUrl: true,
        signedDocumentUploadedAt: true,
      },
    }) as Promise<VolmachtIndexRow[]>,
  ]);

  const vMap = buildVolmachtMap(volmachten);

  const all = [
    ...box3.map(mapBox3Claim),
    ...huur.map((c) => mapHuurClaim(c, vMap)),
    ...energie.map((c) => mapEnergieClaim(c, vMap)),
  ];

  // Open eerst, daarna closed. Binnen elke groep nieuwste createdAt eerst.
  all.sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return all;
}

// ─── Aggregate-stats voor de dashboard-header ───────────────────────────────

export type ClaimDashboardStats = {
  totalCount: number;
  openCount: number;
  closedCount: number;
  totalExpectedCents: number;
  totalRecoveredCents: number;
  totalFeeChargedCents: number;
};

export function computeStats(claims: ReadonlyArray<DashboardClaim>): ClaimDashboardStats {
  const stats: ClaimDashboardStats = {
    totalCount: claims.length,
    openCount: 0,
    closedCount: 0,
    totalExpectedCents: 0,
    totalRecoveredCents: 0,
    totalFeeChargedCents: 0,
  };
  for (const c of claims) {
    if (c.closed) stats.closedCount++;
    else stats.openCount++;
    if (!c.closed) {
      stats.totalExpectedCents += c.verwachteRestitutieCents;
    }
    if (c.werkelijkeRestitutieCents != null) {
      stats.totalRecoveredCents += c.werkelijkeRestitutieCents;
    }
    if (c.feeCents != null && c.statusCode === "CHARGED") {
      stats.totalFeeChargedCents += c.feeCents;
    }
  }
  return stats;
}
