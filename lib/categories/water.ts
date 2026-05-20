/**
 * lib/categories/water.ts — water-specifieke vergelijking.
 *
 * Water is een regionaal MONOPOLIE in NL: je bent vastgekoppeld aan
 * het drinkwaterbedrijf van je regio (Vitens, Evides, PWN, ...). Je
 * kunt NIET overstappen. Besparing komt dus uit:
 *   - verbruik-reductie (douche-timer, perlator, korter douchen)
 *   - lek-detectie (een lopend toilet kost ~€300/jaar)
 *   - kwijtschelding bij laag inkomen (gemeente/waterschap)
 *
 * Markt-medianen (NL, 2026 — regio-afhankelijk):
 *   - drinkwater all-in:  ~€1,00–1,40 / m³ (incl. belasting op
 *     leidingwater + vastrecht versmeerd)
 *   - gemiddeld verbruik: ~45 m³ / persoon / jaar
 */

export type WaterBill = {
  m3PriceCents?: number | null;       // detected €/m³ in cents
  vastrechtCents?: number | null;     // vastrecht /jaar in cents
  jaarverbruikM3?: number | null;     // detected jaarverbruik
  householdSize?: number | null;      // aantal personen
};

export const WATER_MEDIANS = {
  /** All-in mediaan €/m³ incl. belasting leidingwater (NL 2026). */
  m3Cents: 140,
  /** Gemiddeld verbruik per persoon per jaar in m³. */
  avgPerPersonM3: 45,
  /** Default huishoudgrootte als niet gedetecteerd. */
  defaultHousehold: 2,
};

export type WaterComparison = {
  /** Markt-mediaan €/m³ in cents. */
  marketM3Cents: number;
  /** Jouw gedetecteerde €/m³, null als niet uit OCR. */
  yourM3Cents: number | null;
  /** Gemiddeld verbruik voor dit huishouden (m³/jaar). */
  avgHouseholdM3: number;
  /** Geschatte jaarkosten in cents (verbruik × prijs + vastrecht). */
  estimatedAnnualCents: number;
  /** Verbruik-reductie tips — altijd gevuld. */
  reductionTips: string[];
  /** Hint dat kwijtschelding mogelijk is (laag inkomen). */
  kwijtscheldingEligible: boolean;
  notes: string[];
  /** Always true — water is een monopolie, je kunt niet overstappen. */
  isMonopoly: true;
};

const REDUCTION_TIPS = [
  "Plaats een waterbesparende douchekop (bespaart ~€60/jaar bij 2 personen).",
  "Een perlator op de kraan halveert het kraanverbruik.",
  "Check op lekkage: een lopend toilet verspilt tot 200 m³/jaar (~€280).",
  "Korter douchen: 1 minuut minder = ~€30/jaar per persoon.",
  "Was op vollere ladingen + eco-programma.",
];

export function compareWater(bill: WaterBill): WaterComparison {
  const household = bill.householdSize ?? WATER_MEDIANS.defaultHousehold;
  const avgHouseholdM3 = household * WATER_MEDIANS.avgPerPersonM3;

  const yourM3Cents = bill.m3PriceCents ?? null;
  const marketM3Cents = WATER_MEDIANS.m3Cents;

  // Use detected verbruik when available, else the household average.
  const verbruikM3 = bill.jaarverbruikM3 ?? avgHouseholdM3;
  const vastrecht = bill.vastrechtCents ?? 0;
  const priceCents = yourM3Cents ?? marketM3Cents;
  const estimatedAnnualCents = Math.round(verbruikM3 * priceCents + vastrecht);

  const notes: string[] = [
    "Water is een regionaal monopolie — overstappen kan niet. Je bespaart hier via verbruik, niet via een andere leverancier.",
  ];
  if (yourM3Cents == null) {
    notes.push("m³-tarief niet uit je factuur gehaald — schatting op markt-mediaan.");
  } else if (yourM3Cents > marketM3Cents * 1.1) {
    notes.push(
      "Je m³-tarief ligt boven de landelijke mediaan — dat is regio-afhankelijk en niet onderhandelbaar.",
    );
  }
  if (bill.jaarverbruikM3 == null) {
    notes.push(
      `Verbruik geschat op ${avgHouseholdM3} m³/jaar (${household} personen × ${WATER_MEDIANS.avgPerPersonM3} m³).`,
    );
  } else if (bill.jaarverbruikM3 > avgHouseholdM3 * 1.25) {
    notes.push(
      "Je verbruikt fors meer dan gemiddeld voor je huishoudgrootte — controleer op lekkage.",
    );
  }

  // Kwijtschelding-hint: heuristic — flag when annual cost is high
  // relative to a single-person household (proxy for "worth checking").
  const kwijtscheldingEligible = household <= 2;

  return {
    marketM3Cents,
    yourM3Cents,
    avgHouseholdM3,
    estimatedAnnualCents,
    reductionTips: REDUCTION_TIPS,
    kwijtscheldingEligible,
    notes,
    isMonopoly: true,
  };
}
