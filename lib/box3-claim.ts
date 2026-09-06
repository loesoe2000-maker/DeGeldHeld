/**
 * lib/box3-claim.ts — v30 Box 3 NCNP proof-back loop helpers.
 *
 * Pure parsing + revenue-gate logica voor de Box3Claim-flow. De Prisma-IO en
 * Stripe-charge gebeuren in de routes (app/api/box3/*) — die mogen niet door
 * tests aangeraakt worden. Dit bestand is wél volledig pure + testbaar.
 */

import { NO_CURE_NO_PAY_FEE_CAP_CENTS } from "@/lib/payments";
import { parseNlEur } from "@/lib/uitspraak-bedrag";

/** Statussen die een Box3Claim doorloopt — string in DB voor flexibiliteit. */
export type Box3ClaimStatus =
  | "INTENT" // klant gaf intentie aan, vóór mailbevestiging
  | "AWAITING_PROOF" // mail verstuurd, wachten op beschikking-upload
  // v37: PROOF_RECEIVED dekt óók "beschikking gelezen maar charge faalde
  // (bv. geen kaart)" — bewust NIET terminaal, zodat de klant na het
  // toevoegen van een kaart opnieuw kan uploaden én de admin-charge-knop
  // (chargeable voor PROOF_RECEIVED) als handmatig herstel-pad werkt.
  | "PROOF_RECEIVED" // beschikking ge-OCR'd; fee-charge loopt of wacht op kaart
  | "CHARGED" // fee succesvol afgeschreven (of fee € 0 want < drempel)
  | "FAILED"; // terminaal: OCR kon het bedrag niet lezen (handmatige review)

/** HARDE drempel uit guardrail 5 V29: NCNP-aanbod alléén bij ≥ € 500. */
export const BOX3_NCNP_GATE_CENTS = 50_000;

/** Fee-percentage op het werkelijk teruggehaalde bedrag (Box 3-specifiek). */
export const BOX3_NCNP_FEE_PCT = 0.25;

/** Minimum belastingjaar voor de OWR-route (zie V29_DATA_2026.md). */
export const BOX3_MIN_JAAR = 2017;
/** Maximum belastingjaar — 2025 nog open, 2026 nog niet (aanslag pas in 2027). */
export const BOX3_MAX_JAAR = 2024;

/**
 * Validatie voor `POST /api/box3/claim` body. Pure functie.
 * < € 500 verwachte teruggave → reject met reden "below-ncnp-threshold"
 * (de route geeft daarop 422 — geen stille acceptatie).
 */
export type ClaimIntentInput = { jaar: unknown; verwachteTeruggaveCents: unknown };
export type ClaimIntentValidation =
  | { ok: true; jaar: number; verwachteTeruggaveCents: number }
  | { ok: false; reason: "invalid-jaar" | "invalid-amount" | "below-ncnp-threshold" };

export function validateClaimIntent(input: ClaimIntentInput): ClaimIntentValidation {
  const jaar = typeof input.jaar === "number" ? input.jaar : Number(input.jaar);
  if (!Number.isInteger(jaar) || jaar < BOX3_MIN_JAAR || jaar > BOX3_MAX_JAAR) {
    return { ok: false, reason: "invalid-jaar" };
  }
  const cents =
    typeof input.verwachteTeruggaveCents === "number"
      ? input.verwachteTeruggaveCents
      : Number(input.verwachteTeruggaveCents);
  if (!Number.isInteger(cents) || cents <= 0) {
    return { ok: false, reason: "invalid-amount" };
  }
  // v41 — GRATIS PLATFORM: de drempel bestond om te bepalen of een fee
  // loonde. Er is geen fee meer, dus we weigeren niemand meer op
  // geldgrond. De reden blijft in het type staan voor oude callers.
  return { ok: true, jaar, verwachteTeruggaveCents: cents };
}

/**
 * Bereken de NCNP-fee op het werkelijk teruggehaalde bedrag.
 *  - werkelijk < € 500 → fee € 0 (eerlijk; ook al was indicatie hoger).
 *  - anders → 25% × werkelijk, gecapt op de standaard NCNP-cap (€ 500).
 */
export function computeBox3Fee(werkelijkTeruggaveCents: number): number {
  // v41 — GRATIS PLATFORM. DeGeldHeld rekent geen enkele fee meer.
  // Signatuur blijft staan zodat callers en tests blijven werken.
  return 0;
}

/**
 * OCR — werkelijk toegekend bedrag uit een Belastingdienst-beschikking-tekst.
 *
 * Pure regex-parser. Belastingdienst-beschikkingen vermelden het toegekende
 * bedrag in NL met komma-decimalen ("€ 1.234,56" of "1234,56 euro"). We
 * zoeken expliciet naar trefwoord-context ("toegekend"/"teruggave"/"uit te
 * betalen"/"verminderd met") om geen random bedrag van de pagina te grijpen.
 *
 * Returns null als geen ondubbelzinnig bedrag te vinden is (caller → FAILED).
 */
export type ParsedBeschikking = {
  amountCents: number;
  matchedPhrase: string;
};

// Capture: gegroepeerde duizendtallen mét optionele decimalen ("1.234" en
// "1.234,56" — de oude variant backtrackte "1.234" naar "1.23" = €123), óf
// een kale reeks MET verplichte decimalen (jaartallen/refnummers zonder
// centen blijven zo buiten schot; liever FAILED → handmatige review dan een
// gok op een geldbedrag). (?![0-9]) voorkomt half afgekapte reeksen.
const BESCHIKKING_PATTERNS: RegExp[] = [
  // "toegekend bedrag € 1.234,56" / "Toegekend: EUR 1234,56"
  /(?:toegekend\s*bedrag|toegekend|teruggave)[^0-9€]{0,40}(?:€|EUR)?\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+(?:[,.][0-9]{2})?|[0-9]+(?:[,.][0-9]{2}))(?![0-9])/i,
  // "u krijgt … terug" / "uit te betalen aan u: €"
  /(?:uit\s*te\s*betalen|u\s*krijgt[^0-9]{0,30}terug)[^0-9€]{0,40}(?:€|EUR)?\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+(?:[,.][0-9]{2})?|[0-9]+(?:[,.][0-9]{2}))(?![0-9])/i,
  // "vermindering box 3: € 1.234,56"
  /(?:vermindering\s*box\s*3|vermindering\s*op\s*box\s*3)[^0-9€]{0,40}(?:€|EUR)?\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+(?:[,.][0-9]{2})?|[0-9]+(?:[,.][0-9]{2}))(?![0-9])/i,
];

function parseNlEurAmount(s: string): number | null {
  // v39 BLOCKER-fix: positioneel parsen i.p.v. blind punten strippen. De oude
  // versie las "300.00" (OCR die de komma als punt leest) als €30.000 — en
  // dit getal voedt chargeFeeOffSession: bedrag ×100 → onterechte LIVE
  // Stripe-charge. parseNlEur beslist per positie: [.,]+2 cijfers aan het
  // eind = decimaal, separator+3 cijfers = duizendtal.
  return parseNlEur(s);
}

export function parseBeschikkingAmount(text: string): ParsedBeschikking | null {
  if (typeof text !== "string" || text.length === 0) return null;
  // Normaliseer whitespace + lowercase voor matching, maar bewaar originele
  // tekst voor de matchedPhrase-context.
  const flat = text.replace(/\s+/g, " ");
  for (const re of BESCHIKKING_PATTERNS) {
    const m = re.exec(flat);
    if (m && m[1]) {
      const cents = parseNlEurAmount(m[1]);
      if (cents != null) {
        return { amountCents: cents, matchedPhrase: m[0] };
      }
    }
  }
  return null;
}

/**
 * Beslis wat er met een geparsede beschikking moet gebeuren.
 *
 *  - parse-fail → FAILED (handmatige review).
 *  - parse-OK + werkelijk ≥ € 500 → PROOF_RECEIVED → charge fee (deterministisch).
 *  - parse-OK + werkelijk < € 500 → CHARGED met fee € 0 (eerlijke uitkomst).
 */
export type ProofBackDecision =
  | { kind: "fail"; reason: string }
  | { kind: "charge"; werkelijkTeruggaveCents: number; feeCents: number }
  | { kind: "no-fee"; werkelijkTeruggaveCents: number };

export function decideProofBack(parsed: ParsedBeschikking | null): ProofBackDecision {
  if (!parsed) {
    return {
      kind: "fail",
      reason: "Kon het toegekende bedrag niet automatisch uitlezen uit de beschikking.",
    };
  }
  const werkelijk = parsed.amountCents;
  const fee = computeBox3Fee(werkelijk);
  if (fee > 0) {
    return { kind: "charge", werkelijkTeruggaveCents: werkelijk, feeCents: fee };
  }
  return { kind: "no-fee", werkelijkTeruggaveCents: werkelijk };
}

/**
 * Hogere-orde proof-back beslisser: combineert OCR-tekst (van pdf_extract) +
 * claim-status + Stripe-charge tot één gestructureerde uitkomst die de route
 * mechanisch toepast op de DB. Pure (op één async charge-call na), zodat we
 * 'm volledig kunnen testen zonder door `req.formData()` te moeten.
 */
export type ChargeFn = (opts: {
  userId: string;
  negotiationId: string;
  feeCents: number;
}) => Promise<
  | { ok: true; paymentIntentId: string }
  | { ok: false; reason: string }
>;

export type ProofBackOutcome =
  | {
      kind: "charged";
      werkelijkTeruggaveCents: number;
      feeCents: number;
      paymentIntentId: string | null;
    }
  | { kind: "no-fee"; werkelijkTeruggaveCents: number }
  // v37: charge-fail is een APART kind — de beschikking is wél gelezen, alleen
  // het afschrijven faalde (geen kaart / kaart geweigerd). De route mag dit
  // NOOIT als terminale FAILED behandelen: de claim moet herstelbaar blijven.
  | { kind: "charge-failed"; reason: string; werkelijkTeruggaveCents: number }
  | { kind: "failed"; reason: string; werkelijkTeruggaveCents?: number };

export async function processProofUpload(opts: {
  userId: string;
  claimId: string;
  pdfText: string;
  charge: ChargeFn;
}): Promise<ProofBackOutcome> {
  const parsed = parseBeschikkingAmount(opts.pdfText);
  const decision = decideProofBack(parsed);
  if (decision.kind === "fail") {
    return { kind: "failed", reason: decision.reason };
  }
  if (decision.kind === "no-fee") {
    return { kind: "no-fee", werkelijkTeruggaveCents: decision.werkelijkTeruggaveCents };
  }
  // decision.kind === "charge"
  // v41 — GRATIS PLATFORM. computeBox3Fee geeft altijd 0 terug, maar dat is een
  // eigenschap van een ANDERE functie. Deze harde poort staat er zodat er nooit
  // een Stripe-aanroep vertrekt zonder te incasseren bedrag, ook niet als
  // iemand de fee-berekening later per ongeluk terugzet. Nul is geen incasso.
  if (decision.feeCents <= 0) {
    return {
      kind: "charged",
      werkelijkTeruggaveCents: decision.werkelijkTeruggaveCents,
      feeCents: 0,
      paymentIntentId: null,
    };
  }
  const result = await opts.charge({
    userId: opts.userId,
    negotiationId: `box3-${opts.claimId}`,
    feeCents: decision.feeCents,
  });
  if (result.ok) {
    return {
      kind: "charged",
      werkelijkTeruggaveCents: decision.werkelijkTeruggaveCents,
      feeCents: decision.feeCents,
      paymentIntentId: result.paymentIntentId,
    };
  }
  return {
    kind: "charge-failed",
    reason: `charge failed: ${result.reason}`,
    werkelijkTeruggaveCents: decision.werkelijkTeruggaveCents,
  };
}
