import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout — OPGEHEVEN per v41.
 *
 * Tot v41 startte deze route twee echte Stripe Checkout-sessies: de
 * success-fee (20% van de besparing) en de paywall (€ 4,99 per extra
 * rekening). DeGeldHeld brengt niets meer in rekening, dus beide zijn dicht.
 *
 * Bewust 410 in plaats van het bestand verwijderen: een verdwenen route geeft
 * een nietszeggende 404 en verbergt dat de functie doelbewust is opgeheven.
 * De rate limit blijft staan — er wordt nog steeds een sessie-lookup gedaan,
 * en die hoort niet ongelimiteerd aangeroepen te kunnen worden.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit({ key: `checkout:${ipFromRequest(req)}`, max: 10, windowSec: 3600 });
  if (!rl.ok) return rateLimitResponse(rl);

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error: "Gone",
      reason: "fee-disabled",
      uitleg:
        "DeGeldHeld brengt geen kosten meer in rekening. Er valt niets te betalen.",
    },
    { status: 410 },
  );
}
