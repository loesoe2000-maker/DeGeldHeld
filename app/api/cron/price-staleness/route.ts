/**
 * GET /api/cron/price-staleness — monthly (1st, 08:00 UTC).
 *
 * If the market medians in lib/market-prices.ts are older than 90
 * days, email the owner a refresh checklist. CRON_SECRET-protected.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { priceAgeDays, pricesAreStale, pricesAsOfLabel, PRICES_AS_OF } from "@/lib/market-prices";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_DAYS = 90;
const OWNER_EMAIL = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || "hallo@degeldheld.com";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ageDays = priceAgeDays();
  const stale = pricesAreStale(STALE_DAYS);
  if (!stale) {
    return NextResponse.json({ ok: true, stale: false, ageDays, asOf: PRICES_AS_OF });
  }

  try {
    await sendEmail({
      to: OWNER_EMAIL,
      subject: `DeGeldHeld — markt-prijzen verversen (${ageDays} dagen oud)`,
      text: `De markt-medians in lib/market-prices.ts zijn ${ageDays} dagen oud
(laatst bijgewerkt: ${pricesAsOfLabel()}). Tijd om te verversen.

Checklist (werk PRICES_AS_OF + de getallen bij in lib/market-prices.ts):
- ENERGIE: ACM tariefoverzicht (kWh vast/variabel, m³ gas, vastrecht)
- HYPOTHEEK: hypotheekrente-overzicht (10/15/20/30 jaar vast)
- VERZEKERING: Independer/Pricewise auto-premies (WA/WA+/CASCO)
- WATER: drinkwaterbedrijven gemiddeld €/m³

Daarna: commit + push, klaar.

— DeGeldHeld cron`,
      html: `<p>De markt-medians in <code>lib/market-prices.ts</code> zijn
<strong>${ageDays} dagen oud</strong> (laatst bijgewerkt: ${pricesAsOfLabel()}).
Tijd om te verversen.</p>
<p>Checklist — werk <code>PRICES_AS_OF</code> + de getallen bij:</p>
<ul>
<li><strong>ENERGIE</strong>: ACM tariefoverzicht (kWh vast/variabel, m³ gas, vastrecht)</li>
<li><strong>HYPOTHEEK</strong>: hypotheekrente-overzicht (10/15/20/30 jaar vast)</li>
<li><strong>VERZEKERING</strong>: Independer/Pricewise auto-premies (WA/WA+/CASCO)</li>
<li><strong>WATER</strong>: drinkwaterbedrijven gemiddeld €/m³</li>
</ul>
<p>— DeGeldHeld cron</p>`,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "cron/price-staleness" } });
    return NextResponse.json({ ok: false, error: "mail failed", ageDays }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stale: true, ageDays, mailedTo: OWNER_EMAIL });
}
