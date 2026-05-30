/**
 * POST /api/huurcommissie/uitspraak — v35 DEEL 1 (v37: bewijs-opslag).
 *
 * Handmatige proof-back upload. Klant levert een PDF van de Huurcommissie-
 * uitspraak (of verhuurder-bevestiging) + handmatige `werkelijkeRestitutieCents`.
 *
 * v37: de uitspraak wordt nu écht opgeslagen in Vercel Blob (private). Klant
 * kan óf een nieuw bestand uploaden, óf een bestaand kluis-document kiezen
 * (documentId → blob copy).
 *
 * Géén OCR (Huurcommissie-uitspraken komen niet als standaardformaat-PDF).
 * Géén auto-charge: owner reviewt + triggert fee-charge via admin-panel.
 *
 * AVG-grondslag: art. 6 lid 1b — uitvoering NCNP-overeenkomst.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { sendEmail } from "@/lib/email";
import { uploadClaimProof } from "@/lib/claim-proof-storage";
import { attachVaultDocAsProof } from "@/lib/claim-proof-from-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isEnabled("HUURCOMMISSIE_CHECK_ENABLED")) {
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
  // v37 — klant kan i.p.v. een nieuw bestand ook een kluis-document kiezen.
  const documentId = String(form.get("documentId") ?? "");

  if (!claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }
  const werkelijk = Number(werkelijkRaw);
  if (!Number.isInteger(werkelijk) || werkelijk < 0) {
    return NextResponse.json({ error: "invalid werkelijkeRestitutieCents" }, { status: 400 });
  }
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !documentId) {
    return NextResponse.json({ error: "file of documentId vereist" }, { status: 400 });
  }
  if (hasFile && (file as File).size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  // Claim moet van de caller zijn + nog niet terminaal afgesloten.
  const claim = await prisma.huurServicekostenClaim.findFirst({
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

  // v37 — bewijs opslaan: óf een nieuw bestand (Vercel Blob private,
  // best-effort), óf een gekozen kluis-document (blob copy).
  let uitspraakStorageUrl: string | null = null;
  if (hasFile) {
    const f = file as File;
    uitspraakStorageUrl = await uploadClaimProof({
      claimType: "HuurServicekostenClaim",
      userId,
      claimId: claim.id,
      file: f,
      filename: f.name || `huur-uitspraak-${claim.id}`,
      contentType: f.type || undefined,
    });
  } else {
    const attached = await attachVaultDocAsProof({
      documentId,
      userId,
      claimType: "HuurServicekostenClaim",
      claimId: claim.id,
    });
    if (!attached.ok) {
      return NextResponse.json({ error: attached.error }, { status: 400 });
    }
    uitspraakStorageUrl = attached.storageUrl;
  }

  await prisma.huurServicekostenClaim.update({
    where: { id: claim.id },
    data: {
      status: "UITSPRAAK",
      werkelijkeRestitutieCents: werkelijk,
      uitspraakUploadedAt: new Date(),
      ...(uitspraakStorageUrl ? { uitspraakStorageUrl } : {}),
    },
  });

  // Bron-omschrijving voor de owner-mail, veilig voor beide paden.
  const bronLabel = hasFile
    ? `${(file as File).name} (${(file as File).size} bytes)`
    : `uit kluis (document ${documentId.slice(0, 8)})`;

  // Owner krijgt een mail voor handmatige fee-charge review.
  try {
    const adminEmail = process.env.ADMIN_REVIEW_EMAIL ?? "hallo@degeldheld.com";
    await sendEmail({
      to: adminEmail,
      subject: `Huurcommissie-uitspraak ontvangen — claim ${claim.id}`,
      text:
        `Handmatige fee-charge nodig.\n` +
        `Claim: ${claim.id}\n` +
        `User: ${userId}\n` +
        `Boekjaar: ${claim.boekjaar}\n` +
        `Verhuurder: ${claim.verhuurderNaam ?? "(niet opgegeven)"}\n` +
        `Verwacht: ${claim.verwachteRestitutieCents} cents\n` +
        `Werkelijk: ${werkelijk} cents\n` +
        `Bestand: ${bronLabel}`,
      html: `<p>Handmatige fee-charge nodig.</p>
<ul>
  <li>Claim: <code>${claim.id}</code></li>
  <li>User: <code>${userId}</code></li>
  <li>Boekjaar: ${claim.boekjaar}</li>
  <li>Verhuurder: ${claim.verhuurderNaam ?? "(niet opgegeven)"}</li>
  <li>Verwacht: ${claim.verwachteRestitutieCents} cents</li>
  <li>Werkelijk: ${werkelijk} cents</li>
  <li>Bestand: ${bronLabel}</li>
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
