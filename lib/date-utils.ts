/**
 * lib/date-utils.ts — small date helpers shared across crons.
 *
 * Lives in lib/ (not in a route file) because Next.js App Router
 * route.ts modules may only export the HTTP handlers + the recognised
 * config fields — any other export (like `sameMonth`) fails the
 * production `next build` type-check.
 */

/** True when two dates fall in the same calendar month (UTC). */
export function sameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}
