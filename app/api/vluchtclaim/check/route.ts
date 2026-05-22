/**
 * POST /api/vluchtclaim/check — EU261 flight-delay check.
 *
 * Flag-gated (FEATURE_CLAIMS); zonder vlag → 404. Validates the input,
 * vraagt de geconfigureerde flight-data-provider om de werkelijke vertraging
 * + afstand, en rekent met `eu261Compensation` het indicatie-bedrag uit.
 *
 * AVG / privacy: vluchtnummer + datum worden NIET opgeslagen — alleen
 * doorgegeven aan de provider en daarna verwijderd. Geen PII in de response.
 */
import { NextResponse } from "next/server";
import { isEnabled } from "@/lib/feature-flags";
import { isValidFlightDateISO, isValidFlightNumber } from "@/lib/flightdata";
import { getActiveFlightLookup } from "@/lib/flightdata-runtime";
import { eu261Compensation } from "@/lib/eu261";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // GUARDRAIL: route doesn't exist without the flag (notFound-equivalent).
  if (!isEnabled("CLAIMS")) {
    return NextResponse.json({ error: "Not found", reason: "disabled" }, { status: 404 });
  }

  let body: { flightNumber?: unknown; date?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ kind: "error", reason: "bad-json" }, { status: 400 });
  }
  const flightNumber = typeof body.flightNumber === "string" ? body.flightNumber.trim().toUpperCase() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!isValidFlightNumber(flightNumber)) {
    return NextResponse.json({ kind: "error", reason: "invalid-flight-number" }, { status: 400 });
  }
  if (!isValidFlightDateISO(date)) {
    return NextResponse.json({ kind: "error", reason: "invalid-date" }, { status: 400 });
  }

  const provider = getActiveFlightLookup();
  const lookup = await provider.lookup(flightNumber, date);

  if (lookup.kind !== "found") {
    // No key / not implemented / not found → honest "binnenkort"-staat.
    return NextResponse.json({ kind: "no-data", reason: lookup.kind === "no-data" ? lookup.reason : (lookup as { reason: string }).reason });
  }

  const result = eu261Compensation({
    distanceKm: lookup.distanceKm,
    delayMinutes: lookup.delayMinutes,
    withinEU: lookup.withinEU,
    extraordinaryCircumstances: lookup.extraordinaryCircumstances,
  });
  return NextResponse.json({ kind: "found", flight: { flightNumber, date }, result });
}
