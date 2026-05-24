/**
 * POST /api/box3/claim — v30 DEEL 1.
 *
 * Auth-gated. Maakt een Box3Claim met status AWAITING_PROOF (na valid input),
 * stuurt een herinneringsmail met de upload-link en wacht op de beschikking.
 *
 * HARDE €500-gate: verwachteTeruggaveCents < € 500 → 422 + reason. Geen stille
 * acceptatie; de klant krijgt het DIY-pad in de UI getoond.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { sendEmail, escapeHtml } from "@/lib/email";
import { validateClaimIntent } from "@/lib/box3-claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

export async function POST(req: Request) {
  // Gate: zonder BOX3_CHECK_ENABLED bestaat de feature niet.
  if (!isEnabled("BOX3_CHECK_ENABLED")) {
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
    /* below — invalid input handles */
  }
  const validation = validateClaimIntent(
    body as { jaar: unknown; verwachteTeruggaveCents: unknown },
  );
  if (!validation.ok) {
    const status = validation.reason === "below-ncnp-threshold" ? 422 : 400;
    return NextResponse.json({ error: "invalid input", reason: validation.reason }, { status });
  }

  const claim = await prisma.box3Claim.create({
    data: {
      userId,
      jaar: validation.jaar,
      verwachteTeruggaveCents: validation.verwachteTeruggaveCents,
      status: "AWAITING_PROOF",
    },
    select: { id: true },
  });

  // Best-effort herinneringsmail naar de klant met de upload-link.
  const email = (session.user as { email?: string }).email ?? null;
  if (email) {
    try {
      const link = `${APP_URL}/box3-check/proof/${claim.id}`;
      const eur = (validation.verwachteTeruggaveCents / 100).toLocaleString("nl-NL");
      await sendEmail({
        to: email,
        subject: "Box 3-rechtsherstel — upload je beschikking zodra die binnen is",
        text:
          `Hoi,\n\n` +
          `Je hebt aangegeven dat een OWR voor belastingjaar ${validation.jaar} mogelijk ` +
          `€ ${eur} oplevert. Zodra de Belastingdienst-beschikking binnen is, upload je 'm hier:\n\n` +
          `${link}\n\n` +
          `Wij lezen het toegekende bedrag automatisch uit en schrijven dan onze ` +
          `no-cure-no-pay fee van 25% van het werkelijk teruggehaalde bedrag af. Werkelijke ` +
          `teruggave onder € 500? Dan kost je deze claim € 0 — eerlijke uitkomst.\n\n` +
          `— DeGeldHeld`,
        html: `<p>Hoi,</p>
<p>Je hebt aangegeven dat een OWR voor belastingjaar <strong>${validation.jaar}</strong>
mogelijk <strong>€ ${escapeHtml(eur)}</strong> oplevert.</p>
<p>Zodra de Belastingdienst-beschikking binnen is, upload je 'm hier:</p>
<p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Upload beschikking</a></p>
<p>Wij lezen het toegekende bedrag automatisch uit en schrijven dan onze
no-cure-no-pay fee van 25% van het werkelijk teruggehaalde bedrag af. Werkelijke
teruggave onder € 500? Dan kost je deze claim € 0 — eerlijke uitkomst.</p>
<p>— DeGeldHeld</p>`,
      });
    } catch {
      /* never block on outbound mail */
    }
  }

  return NextResponse.json({ ok: true, claimId: claim.id, status: "AWAITING_PROOF" });
}
