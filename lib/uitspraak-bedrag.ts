/**
 * lib/uitspraak-bedrag.ts — v37 idee: bedrag-SUGGESTIE uit een uitspraak/
 * afrekening-document. PURE parser (testbaar zonder Groq/IO).
 *
 * BELANGRIJK ontwerpbesluit: dit levert een SUGGESTIE, nooit een definitief
 * bedrag. De analyse-workflow waarschuwde terecht dat OCR op niet-standaard
 * juridische documenten onbetrouwbaar is — en bij huur/energie bepaalt het
 * bedrag de NCNP-fee. Daarom:
 *   - parser geeft { cents, confidence, context } terug, of null
 *   - de UI vult het bedrag-veld vóór als suggestie; de klant MOET bevestigen
 *   - er wordt NOOIT automatisch een fee afgeschreven op een OCR-getal
 *     (huur/energie charge gebeurt sowieso handmatig door de owner)
 *
 * We hergebruiken bewust het NL-bedragformaat-parsen uit Box 3 (zelfde
 * thousands/decimal-conventie) maar met huur/energie-trefwoorden i.p.v.
 * Belastingdienst-woorden.
 */

/**
 * Parse NL-bedrag positioneel → centen. Een afsluitende [.,] + 2 cijfers is
 * DECIMAAL (ook "300.00" — OCR leest komma's geregeld als punt), een
 * separator + 3 cijfers is duizendtal. Blind separators strippen (de oude
 * implementatie) las "300.00" als 30000 → €30.000: bedrag ×100.
 * "1.234,56"→123456 · "1234.56"→123456 · "300.00"→30000 · "1.234"→123400.
 */
export function parseNlEur(s: string): number | null {
  const compact = s.replace(/\s+/g, "");
  const m = /^(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,](\d{2}))?$/.exec(compact);
  if (!m) return null;
  const cents = Number(m[1].replace(/[.,]/g, "")) * 100 + Number(m[2] ?? "0");
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

export type BedragSuggestie = {
  cents: number;
  /** Hoe zeker zijn we — gebaseerd op het trefwoord dat matchte. */
  confidence: "high" | "low";
  /** De zin/context waar het bedrag uit kwam (voor de "klopt dit?"-UI). */
  context: string;
};

/**
 * Trefwoord-patronen voor huur (Huurcommissie) + energie (Geschillencommissie/
 * leverancier). "high" = sterk restitutie-woord vlak vóór een bedrag.
 * "low" = generiek € bedrag zonder restitutie-context.
 *
 * Volgorde = prioriteit: eerste match wint.
 */
const HIGH_PATTERNS: RegExp[] = [
  // huur: "terug te betalen", "te restitueren", "terugbetaling van"
  /(?:terug\s*te\s*betalen|te\s*restitueren|terugbetaling(?:\s*van)?|restitutie(?:\s*van)?)[^\d€]{0,30}€?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+(?:,[0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)(?![0-9])/i,
  // huur/energie: "te veel (in rekening) gebracht/betaald ... € X"
  /(?:te\s*veel(?:\s*(?:in\s*rekening\s*gebracht|betaald))?)[^\d€]{0,30}€?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+(?:,[0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)(?![0-9])/i,
  // energie: "te verrekenen", "tegoed", "wordt verrekend met ... € X"
  /(?:te\s*verrekenen|tegoed(?:\s*van)?|wordt\s*verrekend[^\d€]{0,20})[^\d€]{0,20}€?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+(?:,[0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)(?![0-9])/i,
  // generiek: "een bedrag van € X" vlak na een toewijzing
  /(?:toegewezen|toekomt|vastgesteld\s*op)[^\d€]{0,30}€?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+(?:,[0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)(?![0-9])/i,
];

// Laatste redmiddel: élk € bedrag (laagste vertrouwen).
const LOW_PATTERN =
  /€\s*([0-9]{1,3}(?:[.\s][0-9]{3})+(?:,[0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)(?![0-9])/i;

/**
 * Zoek een restitutie-bedrag in de tekst van een uitspraak/afrekening.
 * Retourneert de beste suggestie of null. NOOIT bindend — caller toont 'm
 * als voorstel dat de klant bevestigt.
 */
export function suggestUitspraakBedrag(rawText: string): BedragSuggestie | null {
  if (typeof rawText !== "string" || rawText.trim().length === 0) return null;
  const flat = rawText.replace(/\s+/g, " ");

  for (const re of HIGH_PATTERNS) {
    const m = re.exec(flat);
    if (m && m[1]) {
      const cents = parseNlEur(m[1]);
      if (cents != null) {
        return { cents, confidence: "high", context: m[0].trim().slice(0, 120) };
      }
    }
  }

  // Geen trefwoord-context → pak het grootste losse € bedrag, lage confidence.
  // (Bij een uitspraak is het toegewezen bedrag vaak het grootste genoemde.)
  let best: number | null = null;
  let bestContext = "";
  const globalRe = new RegExp(LOW_PATTERN.source, "gi");
  let mm: RegExpExecArray | null;
  while ((mm = globalRe.exec(flat)) !== null) {
    const cents = parseNlEur(mm[1]);
    if (cents != null && (best == null || cents > best)) {
      best = cents;
      bestContext = mm[0].trim();
    }
  }
  if (best != null) {
    return { cents: best, confidence: "low", context: bestContext.slice(0, 120) };
  }
  return null;
}
