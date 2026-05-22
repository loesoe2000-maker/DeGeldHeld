/**
 * lib/flightdata-runtime.ts — module-local provider-override voor tests.
 *
 * Next.js staat geen "willekeurige" exports toe in `app/.../route.ts`, dus we
 * leggen het override-mechaniek hier neer. In productie blijft `_override`
 * null en wordt de adapter via `createFlightLookup(env)` opgebouwd.
 */
import {
  createFlightLookup,
  type FlightLookupProvider,
} from "@/lib/flightdata";

let _override: FlightLookupProvider | null = null;

/** Test-only — injecteer een mock-adapter. In productie nooit aanroepen. */
export function __setFlightLookupForTests(p: FlightLookupProvider | null): void {
  _override = p;
}

/** Actieve provider — test-override of de env-gedreven keuze. */
export function getActiveFlightLookup(): FlightLookupProvider {
  return _override ?? createFlightLookup();
}
