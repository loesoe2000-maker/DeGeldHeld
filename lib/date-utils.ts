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

/**
 * Voeg N maanden toe aan een datum, geclampt op de laatste dag van de
 * doelmaand. Kale setMonth overschiet bij korte doelmaanden (29 feb 2024 +
 * 12 mnd → 1 mrt 2025; 31 jan + 1 mnd → 2/3 mrt) — juridisch relevant voor
 * volmacht-einddatums én huurprijs-termijnen, dus expliciet afgehandeld.
 *
 * v40: verhuisd uit lib/volmacht-pdf.ts (dat pdf-lib importeert) zodat
 * client-side modules zoals lib/huurprijs-check.ts hem kunnen gebruiken
 * zonder de PDF-bundle mee te trekken. volmacht-pdf re-exporteert 'm.
 */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  const dag = r.getDate();
  r.setMonth(r.getMonth() + months);
  // Overschoten naar de volgende maand? Clamp terug naar de laatste dag van
  // de bedoelde maand (setDate(0) = laatste dag van de vorige maand).
  if (r.getDate() < dag) r.setDate(0);
  return r;
}
