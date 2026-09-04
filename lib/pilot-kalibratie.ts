/**
 * lib/pilot-kalibratie.ts — v40 F4 — meet of de huurprijs-check klopt.
 *
 * WAAROM DEZE SPLITSING. Het oorspronkelijke F4-plan ("10-20 zaken,
 * voorspelling naast de uitspraak") was als lanceer-gate onbruikbaar: een
 * Huurcommissie-procedure duurt 4-6 maanden, dus die data bestaat pas een
 * half jaar na de eerste zaak. Daarom twee gates:
 *
 *  GATE A (lanceer-gate, direct haalbaar) — vergelijk onze telling met de
 *    OFFICIELE Huurprijscheck op echte woningen. Kost geen procedure, geen
 *    leges en geen wachttijd; drie echte woningen zijn al zinvol.
 *  GATE B (doorlopend, na lancering) — vergelijk met de echte uitspraak.
 *    Blijft belangrijk, maar blokkeert de lancering niet.
 *
 * De harde eis in beide gates is dezelfde: NUL vals-positieven. Iemand
 * "kansrijk" noemen die het niet is, is de enige fout die de klant geld en
 * ons de geloofwaardigheid kost. De marge-regel bestaat daarvoor; deze
 * kalibratie controleert of hij zijn werk doet.
 */

/** Alleen de velden die de kalibratie nodig heeft (los van Prisma). */
export interface PilotCase {
  id: string;
  label: string;
  onzePunten: number;
  onsVerdict: string;
  onzeMaxHuurCents: number | null;
  kaleHuurCents: number;
  officieelPunten: number | null;
  officieelMaxHuurCents: number | null;
  uitspraakUitkomst: string | null;
  uitspraakPunten: number | null;
}

/**
 * Tolerantie op het puntenverschil. Twee punten: de Huurcommissie meet ter
 * plaatse na en kleine meetverschillen op oppervlakte zijn onvermijdelijk.
 * Dit is een PRODUCTKEUZE, geen wettelijke norm.
 */
export const PUNTEN_TOLERANTIE = 2;
/** Minimum aantal woningen voor gate A. Drie echte woningen, geen twintig. */
export const GATE_A_MIN_CASES = 3;
/** Minimum aantal uitspraken voor gate B. */
export const GATE_B_MIN_CASES = 5;

export interface GateUitkomst {
  gehaald: boolean;
  redenen: string[];
}

export interface KalibratieRapport {
  aantalCases: number;
  aantalMetOfficieel: number;
  aantalMetUitspraak: number;
  /** Onze punten minus de officiële, per case met een officiële telling. */
  puntenVerschillen: Array<{ id: string; label: string; verschil: number }>;
  gemiddeldAbsoluutVerschil: number | null;
  grootsteAfwijking: { id: string; label: string; verschil: number } | null;
  binnenTolerantie: number;
  /** Cases waar we "kansrijk" zeiden terwijl de werkelijkheid dat weerspreekt. */
  valsPositieven: Array<{ id: string; label: string; reden: string }>;
  gateA: GateUitkomst;
  gateB: GateUitkomst;
}

export function berekenKalibratie(cases: PilotCase[]): KalibratieRapport {
  const metOfficieel = cases.filter((c) => c.officieelPunten != null);
  const metUitspraak = cases.filter(
    (c) => c.uitspraakUitkomst != null && c.uitspraakUitkomst !== "LOPEND",
  );

  const puntenVerschillen = metOfficieel.map((c) => ({
    id: c.id,
    label: c.label,
    verschil: c.onzePunten - (c.officieelPunten as number),
  }));

  const gemiddeldAbsoluutVerschil =
    puntenVerschillen.length === 0
      ? null
      : Math.round(
          (puntenVerschillen.reduce((s, v) => s + Math.abs(v.verschil), 0) /
            puntenVerschillen.length) *
            100,
        ) / 100;

  const grootsteAfwijking =
    puntenVerschillen.length === 0
      ? null
      : puntenVerschillen.reduce((a, b) =>
          Math.abs(b.verschil) > Math.abs(a.verschil) ? b : a,
        );

  const binnenTolerantie = puntenVerschillen.filter(
    (v) => Math.abs(v.verschil) <= PUNTEN_TOLERANTIE,
  ).length;

  // Vals-positief: wij zeiden "kansrijk", maar de werkelijkheid zegt dat er
  // niets te halen viel. Twee manieren om dat vast te stellen.
  const valsPositieven: KalibratieRapport["valsPositieven"] = [];
  for (const c of cases) {
    if (c.onsVerdict !== "kansrijk") continue;
    if (
      c.officieelMaxHuurCents != null &&
      c.kaleHuurCents <= c.officieelMaxHuurCents
    ) {
      valsPositieven.push({
        id: c.id,
        label: c.label,
        reden:
          "wij zeiden kansrijk, maar volgens de officiële check zit de huur " +
          "op of onder het maximum",
      });
      continue;
    }
    if (c.uitspraakUitkomst === "VERLOREN") {
      valsPositieven.push({
        id: c.id,
        label: c.label,
        reden: "wij zeiden kansrijk, maar de Huurcommissie wees de zaak af",
      });
    }
  }

  // ─── Gate A: lanceer-gate op de officiële check ───
  const redenenA: string[] = [];
  if (metOfficieel.length < GATE_A_MIN_CASES) {
    redenenA.push(
      `Nog ${GATE_A_MIN_CASES - metOfficieel.length} woning(en) te gaan: ` +
        `${metOfficieel.length} van ${GATE_A_MIN_CASES} vergeleken met de officiële check.`,
    );
  }
  const buitenTolerantie = puntenVerschillen.filter(
    (v) => Math.abs(v.verschil) > PUNTEN_TOLERANTIE,
  );
  for (const v of buitenTolerantie) {
    redenenA.push(
      `"${v.label}" wijkt ${Math.abs(v.verschil)} punten af (tolerantie is ` +
        `${PUNTEN_TOLERANTIE}) — uitzoeken vóór de flag aan mag.`,
    );
  }
  for (const vp of valsPositieven) {
    redenenA.push(`VALS POSITIEF bij "${vp.label}": ${vp.reden}.`);
  }
  const gateA: GateUitkomst = {
    gehaald:
      metOfficieel.length >= GATE_A_MIN_CASES &&
      buitenTolerantie.length === 0 &&
      valsPositieven.length === 0,
    redenen: redenenA,
  };

  // ─── Gate B: doorlopend, op echte uitspraken ───
  const redenenB: string[] = [];
  if (metUitspraak.length < GATE_B_MIN_CASES) {
    redenenB.push(
      `${metUitspraak.length} van ${GATE_B_MIN_CASES} uitspraken binnen — ` +
        "een procedure duurt 4 tot 6 maanden, dus dit loopt door na de lancering.",
    );
  }
  const verlorenNaKansrijk = valsPositieven.filter((v) =>
    v.reden.includes("afgewezen") || v.reden.includes("wees de zaak af"),
  );
  for (const v of verlorenNaKansrijk) {
    redenenB.push(`Verloren zaak na "kansrijk"-advies: "${v.label}".`);
  }
  const gateB: GateUitkomst = {
    gehaald: metUitspraak.length >= GATE_B_MIN_CASES && verlorenNaKansrijk.length === 0,
    redenen: redenenB,
  };

  return {
    aantalCases: cases.length,
    aantalMetOfficieel: metOfficieel.length,
    aantalMetUitspraak: metUitspraak.length,
    puntenVerschillen,
    gemiddeldAbsoluutVerschil,
    grootsteAfwijking,
    binnenTolerantie,
    valsPositieven,
    gateA,
    gateB,
  };
}
