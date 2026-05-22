/**
 * lib/eu261.ts — pure EU261 vluchtcompensatie-calculator.
 *
 * De ECHTE vluchtdata (vertraging, afstand, oorzaak) komt van een
 * flight-data-API (Aviation Edge / AviationStack — owner-task: API-key +
 * juridische volmacht achter `FEATURE_CLAIMS`). Deze module gaat alléén over
 * de uitkomst-berekening en is volledig zonder I/O testbaar.
 *
 * ⚠️ Bedragen en drempels EXACT uit docs/BENEFITS_DATA_2026.md (sourced).
 * EU-verordening 261/2004 — in 2026 ongewijzigd, hervormingsvoorstellen lopen
 * maar de huidige bands staan. NL verjaring: 2 jaar na de vluchtdatum.
 *
 * bron: Europa.eu (rechten vliegtuigpassagiers) · EUclaim (verordening 261/2004)
 */

/** Drempel- en compensatie-tabel EU261 — verifieerbaar in docs/BENEFITS_DATA_2026.md. */
export const EU261 = {
  // Drempels
  shortHaulKm: 1500, //   ≤ 1.500 km → "short"
  longHaulKm: 3500, //    > 3.500 km → "long" (drempel 4u i.p.v. 3u)
  delayShortMin: 180, //  ≥ 3 u
  delayLongMin: 240, //   ≥ 4 u (voor > 3.500 km)
  // Bedragen (cents)
  payShortCents: 25_000, //   € 250
  payMediumCents: 40_000, //  € 400
  payLongCents: 60_000, //    € 600
  // NL verjaring
  verjaringJaren: 2,
} as const;

export type Eu261Band = "short" | "medium" | "long" | "none";

export type Eu261Input = {
  /** Grootcirkelafstand van vertrek tot eindbestemming in kilometers. */
  distanceKm: number;
  /** Werkelijke aankomstvertraging op de eindbestemming in minuten. */
  delayMinutes: number;
  /**
   * Vlucht binnen de EU (vertrek + aankomst beide in een EU-lidstaat).
   * Relevant voor de middenband (EU > 1.500 km = € 400, ongeacht of het
   * onder/boven 3.500 km zit).
   */
  withinEU: boolean;
  /**
   * Buitengewone omstandigheden (storm, ATC-staking, vogelaanvaring, etc.).
   * Bij true → geen compensatie. Personeelsstaking bij de maatschappij
   * zelf telt NIET als buitengewoon → false meegeven.
   */
  extraordinaryCircumstances?: boolean;
};

export type Eu261Result = {
  eligible: boolean;
  band: Eu261Band;
  amountCents: number;
  reden: string; // korte uitleg waarom wel/niet
};

/**
 * Bereken de EU261-compensatie. Pure functie — geen I/O.
 * Bij twijfel/ontbrekende data → eligible=false met een uitleg-reden.
 */
export function eu261Compensation(input: Eu261Input): Eu261Result {
  const { distanceKm, delayMinutes, withinEU, extraordinaryCircumstances } = input;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return { eligible: false, band: "none", amountCents: 0, reden: "Onbekende afstand." };
  }
  if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
    return { eligible: false, band: "none", amountCents: 0, reden: "Onbekende vertraging." };
  }
  if (extraordinaryCircumstances === true) {
    return {
      eligible: false,
      band: "none",
      amountCents: 0,
      reden:
        "Buitengewone omstandigheid (bijv. extreem weer, ATC-staking) — geen recht op compensatie.",
    };
  }
  // Bepaal de toepasselijke band + vereiste drempel
  if (distanceKm <= EU261.shortHaulKm) {
    if (delayMinutes < EU261.delayShortMin) {
      return {
        eligible: false,
        band: "short",
        amountCents: 0,
        reden: "Korte vlucht (≤ 1.500 km) — minimaal 3 u vertraging nodig.",
      };
    }
    return {
      eligible: true,
      band: "short",
      amountCents: EU261.payShortCents,
      reden: "≤ 1.500 km en ≥ 3 u vertraging.",
    };
  }
  if (distanceKm > EU261.longHaulKm) {
    // > 3.500 km — drempel 4 uur voor de € 600-band; tussen 3 en 4 u kan een
    // gehalveerde compensatie ontstaan (Verordening art. 7 lid 2), maar dat is
    // jurisprudentie-afhankelijk → we tonen alleen het volle recht hier.
    if (delayMinutes < EU261.delayLongMin) {
      if (delayMinutes >= EU261.delayShortMin) {
        return {
          eligible: false,
          band: "long",
          amountCents: 0,
          reden:
            "Lange vlucht (> 3.500 km) — vol recht (€ 600) vanaf 4 u; tussen 3-4 u soms gehalveerd, " +
            "laat een specialist meekijken.",
        };
      }
      return {
        eligible: false,
        band: "long",
        amountCents: 0,
        reden: "Lange vlucht (> 3.500 km) — minimaal 4 u vertraging nodig voor vol recht.",
      };
    }
    return {
      eligible: true,
      band: "long",
      amountCents: EU261.payLongCents,
      reden: "> 3.500 km en ≥ 4 u vertraging.",
    };
  }
  // 1.500 < distance ≤ 3.500 km → middenband € 400 (zowel EU-intern > 1.500 als
  // niet-EU 1.500-3.500). Drempel: 3 uur.
  if (delayMinutes < EU261.delayShortMin) {
    return {
      eligible: false,
      band: "medium",
      amountCents: 0,
      reden:
        (withinEU ? "EU-vlucht > 1.500 km" : "Vlucht 1.500-3.500 km") +
        " — minimaal 3 u vertraging nodig.",
    };
  }
  return {
    eligible: true,
    band: "medium",
    amountCents: EU261.payMediumCents,
    reden:
      (withinEU ? "EU-vlucht > 1.500 km" : "Vlucht 1.500-3.500 km") +
      " en ≥ 3 u vertraging.",
  };
}
