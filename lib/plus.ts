/**
 * lib/plus.ts — DeGeldHeld Plus (abonnement) als cashflow-motor.
 *
 * Pure waarde-propositie + her-check-cadence logica. Géén Stripe-koppeling
 * hier (live billing wacht op KYC — zie CLAUDE.md); deze module beschrijft
 * de positionering + wanneer een her-check van toeslagen/vaste lasten "due"
 * is, zodat het abonnement zinvol blijft tussen aanvragen door.
 *
 * Klant betaalt → 100% aligned (model B: nooit providergeld).
 */

/** Hoe vaak we ten minste her-checken (calendar baseline). */
export const RECHECK_CADENCE_DAYS = 90; // ~ ieder kwartaal

/** Indicatieve prijsband voor de communicatie — geen live Stripe-prijs. */
export const PLUS_PRICE = { lowEur: 2.99, highEur: 4.99 } as const;

/** De waarde-pijlers — server-component leest dit, tests locken inhoud. */
export type PlusPillar = {
  id: "rescan" | "hercheck" | "alerts" | "nsclaim";
  title: string;
  body: string;
};

export const PLUS_PILLARS: ReadonlyArray<PlusPillar> = [
  {
    id: "rescan",
    title: "Maandelijkse her-scan van je vaste lasten",
    body:
      "Telkens als je nieuwe rekening binnenkomt, kijken we of er weer ruimte zit — " +
      "telecom, internet, energie, streaming én water (waar geen onderhandel-fee zit).",
  },
  {
    id: "hercheck",
    title: "Periodieke her-check toeslagen + gemeente-regelingen + Box 3",
    body:
      "Inkomen, gezinssituatie en de grenzen wijzigen door de tijd. We her-checken " +
      "elk kwartaal en bij elke jaarwisseling — dan staan de nieuwe 2027-bedragen klaar.",
  },
  {
    id: "alerts",
    title: "Alerts: contract-einde, prijsstijging, grens-wijziging",
    body:
      "Een mailtje vlák voordat je contract verlengt of als een provider gaat verhogen, " +
      "zodat je op het juiste moment kunt onderhandelen of overstappen.",
  },
  {
    id: "nsclaim",
    title: "Auto-claim: élke NS-vertraging herinnerd",
    body:
      "Plus scant je treinritten en seint zodra je recht hebt op compensatie — vóór de " +
      "1-maands-deadline van NS. De claim zelf indien je nog steeds zelf via Mijn NS, maar " +
      "je vergeet hem niet meer. Onderdeel van Plus, geen losse fee.",
  },
];

/** Aantal volle dagen tussen een ISO-datum en nu. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY; // ongeldig → behandel als "lang geleden"
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/**
 * Zit er een kalenderjaar-grens tussen `lastISO` en `now`? Dan zijn de
 * toeslagen-grenzen waarschijnlijk gewijzigd (Belastingdienst publiceert
 * nieuwe bedragen per 1 januari) → her-check forceren.
 */
export function crossesYearBoundary(lastISO: string, now: Date = new Date()): boolean {
  const t = new Date(lastISO);
  if (!Number.isFinite(t.getTime())) return true;
  return t.getUTCFullYear() < now.getUTCFullYear();
}

/**
 * Is een her-check van de toeslagen/regelingen "due"?
 *   - nog nooit gedaan → ja
 *   - ≥ RECHECK_CADENCE_DAYS dagen geleden → ja
 *   - laatste check in een vorig kalenderjaar → ja (nieuwe bedragen per 1 jan)
 *
 * Pure functie; los testbaar zonder I/O.
 */
export function shouldRecheckBenefits(
  lastCheckedISO: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastCheckedISO) return true;
  return (
    daysSince(lastCheckedISO, now) >= RECHECK_CADENCE_DAYS ||
    crossesYearBoundary(lastCheckedISO, now)
  );
}

/**
 * Wanneer is de volgende her-check op zijn vroegst due? Wordt zowel door de
 * UI ("volgende her-check op …") als door een eventuele scheduler gebruikt.
 */
export function nextRecheckDue(
  lastCheckedISO: string,
  now: Date = new Date(),
): Date {
  const last = new Date(lastCheckedISO);
  if (!Number.isFinite(last.getTime())) return now;
  // RECHECK_CADENCE_DAYS na de vorige check, of begin van het nieuwe jaar — de
  // vroegste van de twee.
  const cadenceDue = new Date(last.getTime() + RECHECK_CADENCE_DAYS * 86_400_000);
  const nextYearStart = new Date(Date.UTC(last.getUTCFullYear() + 1, 0, 1));
  return cadenceDue < nextYearStart ? cadenceDue : nextYearStart;
}
