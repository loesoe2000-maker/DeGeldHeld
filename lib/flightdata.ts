/**
 * lib/flightdata.ts — flight-data adapter voor de EU261-check.
 *
 * Provider-onafhankelijk: een interface + factory die op basis van env-keys
 * een echte provider kiest (Aviation Edge / AviationStack), of een `noop`
 * provider die `no-data` teruggeeft als nog niets is geconfigureerd. Zo blijft
 * /vluchtclaim eerlijk in een "binnenkort"-staat tot de eigenaar de key + de
 * juridische check rond heeft (FEATURE_CLAIMS-gate); de pure eu261-calc in
 * lib/eu261.ts is altijd al getest, los van deze adapter.
 *
 * GEEN echte fetch-implementatie in deze sprint: de officiële API-shape +
 * IATA-afstandstabel staan in de eigenaar-task (V28_REPORT.md). Adapter
 * geeft tot die tijd `no-data: needs-implementation` terug — geen halve
 * waarheid, geen verzonnen vluchtdata.
 */

export type FlightLookupResult =
  | {
      kind: "found";
      distanceKm: number;
      delayMinutes: number;
      withinEU: boolean;
      // Optioneel: of de oorzaak een buitengewone omstandigheid was (storm,
      // ATC-staking). Bron-afhankelijk; default false als de provider niet
      // explicit zegt dat het wél buitengewoon was.
      extraordinaryCircumstances?: boolean;
    }
  | { kind: "no-data"; reason: "no-provider" | "not-found" | "needs-implementation" }
  | { kind: "error"; reason: string };

export interface FlightLookupProvider {
  name: string;
  lookup(flightNumber: string, dateISO: string): Promise<FlightLookupResult>;
}

/** No-key fallback — eerlijk, geen verzonnen data. */
export const noopFlightLookup: FlightLookupProvider = {
  name: "noop",
  async lookup() {
    return { kind: "no-data", reason: "no-provider" };
  },
};

/**
 * Aviation Edge — stub. De echte HTTP-fetch + IATA-afstandstabel komen
 * in de owner-stap (key configureren + jurist-check). Tot die tijd: no-data
 * met reden "needs-implementation" zodat de UI eerlijk "binnenkort" toont.
 *
 * bron-API: https://aviation-edge.com/v2/public/flightsHistory
 */
export function aviationEdgeProvider(_apiKey: string): FlightLookupProvider {
  return {
    name: "aviation-edge",
    async lookup() {
      return { kind: "no-data", reason: "needs-implementation" };
    },
  };
}

/**
 * AviationStack — stub (zelfde reden als hierboven).
 * bron-API: https://aviationstack.com/documentation
 */
export function aviationStackProvider(_apiKey: string): FlightLookupProvider {
  return {
    name: "aviation-stack",
    async lookup() {
      return { kind: "no-data", reason: "needs-implementation" };
    },
  };
}

/** Kies een provider op basis van env-keys; geen key → noop. */
export function createFlightLookup(
  env: NodeJS.ProcessEnv = process.env,
): FlightLookupProvider {
  if (env.AVIATION_EDGE_KEY) return aviationEdgeProvider(env.AVIATION_EDGE_KEY);
  if (env.AVIATIONSTACK_KEY) return aviationStackProvider(env.AVIATIONSTACK_KEY);
  return noopFlightLookup;
}

// IATA-airline-code is 2 chars alphanumeric (≥ 1 letter; bv. KL, U2, 4U, 9W),
// soms 3 (ICAO/charter); daarna 1-4 cijfers en optioneel een eindletter.
const FLIGHT_NUMBER_RE = /^(?=.*[A-Z])[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/i;

export function isValidFlightNumber(s: string): boolean {
  if (typeof s !== "string") return false;
  return FLIGHT_NUMBER_RE.test(s.replace(/\s+/g, ""));
}

/**
 * Datum-validatie: YYYY-MM-DD, niet in de toekomst, en binnen de EU261-
 * verjaringstermijn (2 jaar — zie docs/BENEFITS_DATA_2026.md).
 */
export function isValidFlightDateISO(s: string, now: Date = new Date()): boolean {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = new Date(s + "T00:00:00Z").getTime();
  if (!Number.isFinite(t)) return false;
  if (t > now.getTime()) return false;
  const twoYearsAgoMs = now.getTime() - 2 * 365.25 * 86_400_000;
  return t >= twoYearsAgoMs;
}
