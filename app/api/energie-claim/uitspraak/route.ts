/**
 * POST /api/energie-claim/uitspraak — v35 DEEL 2.
 *
 * Handmatige proof-back upload. Klant levert PDF van de Geschillencommissie-
 * uitspraak (of leverancier-bevestiging) + handmatige `werkelijkeRestitutieCents`.
 *
 * Géén OCR in V35. Géén auto-charge: owner reviewt + triggert fee handmatig.
 *
 * AVG-grondslag: art. 6 lid 1b — uitvoering NCNP-overeenkomst.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isEnabled("ENERGIE_CLAIM_CHECK_ENABLED")) {
    return NextResponse.json({ error: "Not found", reason: "disabled" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form-data required" }, { status: 400 });
  }

  const claimId = String(form.get("claimId") ?? "");
  const werkelijkRaw = String(form.get("werkelijkeRestitutieCents") ?? "");
  const file = form.get("file");

  if (!claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }
  const werkelijk = Number(werkelijkRaw);
  if (!Number.isInteger(werkelijk) || werkelijk < 0) {
    return NextResponse.json({ error: "invalid werkelijkeRestitutieCents" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const claim = await prisma.energieEindafrekeningClaim.findFirst({
    where: { id: claimId, userId },
  });
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (claim.status === "CHARGED" || claim.status === "FAILED") {
    return NextResponse.json(
      { error: "claim already settled", status: claim.status },
      { status: 409 },
    );
  }

  // V35 stub-storage: alleen metadata. Vercel Blob = V36 eigenaar-werk.
  await prisma.energieEindafrekeningClaim.update({
    where: { id: claim.id },
    data: {
      status: "UITSPRAAK",
      werkelijkeRestitutieCents: werkelijk,
      uitspraakUploadedAt: new Date(),
    },
  });

  try {
    const adminEmail = process.env.ADMIN_REVIEW_EMAIL ?? "hallo@degeldheld.com";
    await sendEmail({
      to: adminEmail,
      subject: `Energie-claim uitspraak ontvangen — claim ${claim.id}`,
      text:
        `Handmatige fee-charge nodig.\n` +
        `Claim: ${claim.id}\n` +
        `User: ${userId}\n` +
        `Provider: ${claim.provider}\n` +
        `Verwacht: ${claim.verwachteRestitutieCents} cents\n` +
        `Werkelijk: ${werkelijk} cents\n` +
        `Bestand: ${file.name} (${file.size} bytes)`,
      html: `<p>Handmatige fee-charge nodig.</p>
<ul>
  <li>Claim: <code>${claim.id}</code></li>
  <li>User: <code>${userId}</code></li>
  <li>Provider: ${claim.provider}</li>
  <li>Verwacht: ${claim.verwachteRestitutieCents} cents</li>
  <li>Werkelijk: ${werkelijk} cents</li>
  <li>Bestand: ${file.name} (${file.size} bytes)</li>
</ul>`,
    });
  } catch {
    /* never block on outbound mail */
  }

  return NextResponse.json({
    ok: true,
    status: "UITSPRAAK",
    werkelijkeRestitutieCents: werkelijk,
  });
}
