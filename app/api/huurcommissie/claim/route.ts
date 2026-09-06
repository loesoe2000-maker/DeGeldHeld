/**
 * POST /api/huurcommissie/claim — v35 DEEL 1.
 *
 * Auth-gated. Maakt een HuurServicekostenClaim met status INTENT (NCNP-keuze
 * gemaakt). Klant moet daarna zelf bezwaar bij verhuurder + eventueel
 * Huurcommissie indienen — V35 doet géén relay-mail.
 *
 * HARDE €50-gate: verwachteRestitutieCents < € 50 → 422 + reason. Geen stille
 * acceptatie; de klant krijgt het DIY-pad in de UI getoond.
 *
 * Géén OCR + géén auto-charge in V35: de fee-charge gebeurt later via
 * /api/huurcommissie/uitspraak + handmatige owner-review (admin-panel V36).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { sendEmail, escapeHtml } from "@/lib/email";
import { validateHuurClaimIntent } from "@/lib/huurcommissie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

export async function POST(req: Request) {
  if (!isEnabled("HUURCOMMISSIE_CHECK_ENABLED")) {
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
  const validation = validateHuurClaimIntent(
    body as { boekjaar: unknown; verwachteRestitutieCents: unknown; verhuurderNaam?: unknown },
  );
  if (!validation.ok) {
    const status = validation.reason === "below-ncnp-threshold" ? 422 : 400;
    return NextResponse.json({ error: "invalid input", reason: validation.reason }, { status });
  }

  const claim = await prisma.huurServicekostenClaim.create({
    data: {
      userId,
      boekjaar: validation.boekjaar,
      verhuurderNaam: validation.verhuurderNaam,
      verwachteRestitutieCents: validation.verwachteRestitutieCents,
      status: "INTENT",
    },
    select: { id: true },
  });

  // Best-effort herinneringsmail naar de klant met upload-link voor de uitspraak.
  const email = (session.user as { email?: string }).email ?? null;
  if (email) {
    try {
      const link = `${APP_URL}/huurcommissie-check/proof/${claim.id}`;
      const eur = (validation.verwachteRestitutieCents / 100).toLocaleString("nl-NL");
      await sendEmail({
        to: email,
        subject: "Huurcommissie-bezwaar servicekosten — volgende stappen",
        text:
          `Hoi,\n\n` +
          `Je hebt aangegeven dat een bezwaar tegen de servicekosten-afrekening over ` +
          `${validation.boekjaar} mogelijk € ${eur} restitutie oplevert. We hebben je ` +
          `claim aangemaakt — volgende stappen:\n\n` +
          `1. Stuur je verhuurder een schriftelijk bezwaar (DIY-brief staat op /huurcommissie-check).\n` +
          `2. Geen of geen passende reactie binnen 3 weken → dien in bij de Huurcommissie ` +
          `(leges € 25, terug bij winst).\n` +
          `3. Zodra de Huurcommissie-uitspraak binnen is, upload je 'm hier:\n\n` +
          `${link}\n\n` +
          `Aan het gebruik van DeGeldHeld zijn geen kosten verbonden. De hierboven ` +
          `genoemde leges betaal je aan de instantie zelf, niet aan ons.\n\n` +
          `— DeGeldHeld`,
        html: `<p>Hoi,</p>
<p>Je hebt aangegeven dat een bezwaar tegen de servicekosten-afrekening over
<strong>${validation.boekjaar}</strong> mogelijk <strong>€ ${escapeHtml(eur)}</strong>
restitutie oplevert. We hebben je claim aangemaakt — volgende stappen:</p>
<ol>
  <li>Stuur je verhuurder een schriftelijk bezwaar (DIY-brief staat op /huurcommissie-check).</li>
  <li>Geen of geen passende reactie binnen 3 weken → dien in bij de Huurcommissie (leges € 25, terug bij winst).</li>
  <li>Zodra de Huurcommissie-uitspraak binnen is, upload je 'm hier:</li>
</ol>
<p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Upload uitspraak</a></p>
<p>Aan het gebruik van DeGeldHeld zijn geen kosten verbonden. De hierboven genoemde
leges betaal je aan de instantie zelf, niet aan ons.</p>
<p>— DeGeldHeld</p>`,
      });
    } catch {
      /* never block on outbound mail */
    }
  }

  return NextResponse.json({ ok: true, claimId: claim.id, status: "INTENT" });
}
