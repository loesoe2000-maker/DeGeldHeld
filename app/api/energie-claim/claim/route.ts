/**
 * POST /api/energie-claim/claim — v35 DEEL 2.
 *
 * Auth-gated. Maakt een EnergieEindafrekeningClaim met status INTENT (NCNP-keuze
 * gemaakt). Klant moet daarna zelf klacht bij leverancier indienen + eventueel
 * escaleren naar Geschillencommissie Energie — V35 doet géén relay-mail.
 *
 * HARDE €50-gate: verwachteRestitutieCents < € 50 → 422 + reason. Geen stille
 * acceptatie.
 *
 * Géén OCR + géén auto-charge in V35: fee-charge gebeurt later via
 * /api/energie-claim/uitspraak + handmatige owner-review.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { sendEmail, escapeHtml } from "@/lib/email";
import { validateEnergieClaimIntent } from "@/lib/energie-claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

export async function POST(req: Request) {
  if (!isEnabled("ENERGIE_CLAIM_CHECK_ENABLED")) {
    return NextResponse.json({ error: "Not found", reason: "disabled" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* falls through to validation error */
  }
  const validation = validateEnergieClaimIntent(
    body as { provider: unknown; verwachteRestitutieCents: unknown },
  );
  if (!validation.ok) {
    const status = validation.reason === "below-ncnp-threshold" ? 422 : 400;
    return NextResponse.json({ error: "invalid input", reason: validation.reason }, { status });
  }

  const claim = await prisma.energieEindafrekeningClaim.create({
    data: {
      userId,
      provider: validation.provider,
      verwachteRestitutieCents: validation.verwachteRestitutieCents,
      status: "INTENT",
    },
    select: { id: true },
  });

  const email = (session.user as { email?: string }).email ?? null;
  if (email) {
    try {
      const link = `${APP_URL}/energie-claim-check/proof/${claim.id}`;
      const eur = (validation.verwachteRestitutieCents / 100).toLocaleString("nl-NL");
      const provider = escapeHtml(validation.provider);
      await sendEmail({
        to: email,
        subject: "Energie-eindafrekening-klacht — volgende stappen",
        text:
          `Hoi,\n\n` +
          `Je hebt aangegeven dat een klacht over je ${validation.provider}-eindafrekening ` +
          `mogelijk € ${eur} restitutie oplevert. We hebben je claim aangemaakt — ` +
          `volgende stappen:\n\n` +
          `1. Stuur je leverancier een formele klachtbrief (DIY-brief staat op /energie-claim-check).\n` +
          `2. Geen of geen passende reactie binnen 30 dagen → escaleer naar de Geschillencommissie ` +
          `Energie (leges € 27,50, klachtgeld € 52,50 terug bij winst).\n` +
          `3. Zodra de uitspraak binnen is, upload je 'm hier:\n\n` +
          `${link}\n\n` +
          `Onze fee = 20% van het werkelijk teruggehaalde bedrag, alleen áls je geld terugkrijgt. ` +
          `Onder € 50 werkelijk → fee € 0.\n\n` +
          `— DeGeldHeld`,
        html: `<p>Hoi,</p>
<p>Je hebt aangegeven dat een klacht over je <strong>${provider}</strong>-eindafrekening
mogelijk <strong>€ ${escapeHtml(eur)}</strong> restitutie oplevert. We hebben je claim
aangemaakt — volgende stappen:</p>
<ol>
  <li>Stuur je leverancier een formele klachtbrief (DIY-brief staat op /energie-claim-check).</li>
  <li>Geen of geen passende reactie binnen 30 dagen → escaleer naar de Geschillencommissie Energie (leges € 27,50, klachtgeld € 52,50 terug bij winst).</li>
  <li>Zodra de uitspraak binnen is, upload je 'm hier:</li>
</ol>
<p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Upload uitspraak</a></p>
<p>Onze fee = 20% van het werkelijk teruggehaalde bedrag, alleen áls je geld terugkrijgt.
Onder € 50 werkelijk → fee € 0.</p>
<p>— DeGeldHeld</p>`,
      });
    } catch {
      /* never block on outbound mail */
    }
  }

  return NextResponse.json({ ok: true, claimId: claim.id, status: "INTENT" });
}
