/**
 * POST /api/volmacht/[claimType]/[claimId]/upload-signed — v36 idee 2.
 *
 * Klant heeft het machtigings-PDF gedownload, geprint, ondertekend en
 * weer gescand/gefotografeerd. Deze route accepteert die scan en koppelt
 * 'm aan de bestaande Volmacht-row (of maakt een nieuwe als nog niet
 * bestaand).
 *
 * Validation hergebruikt `validateUpload` uit lib/user-documents — PDF/
 * JPG/PNG, max 10 MB.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";
import { ipFromRequest } from "@/lib/rate-limit";
import {
  isVolmachtClaimType,
  volmachtMandateText,
  VOLMACHT_TEMPLATE_VERSION,
  type VolmachtClaimType,
} from "@/lib/volmacht";
import { hashIp } from "@/lib/volmacht-server";
import { validateUpload } from "@/lib/user-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { claimType: string; claimId: string } };

async function getClaimInfo(
  claimType: VolmachtClaimType,
  claimId: string,
  userId: string,
): Promise<{ ok: true; zaak: string } | { ok: false }> {
  if (claimType === "HuurServicekostenClaim") {
    const c = await prisma.huurServicekostenClaim.findUnique({
      where: { id: claimId },
      select: { userId: true, boekjaar: true, verhuurderNaam: true },
    });
    if (!c || c.userId !== userId) return { ok: false };
    return {
      ok: true,
      zaak: `${c.boekjaar}${c.verhuurderNaam ? ` (${c.verhuurderNaam})` : ""}`,
    };
  }
  const c = await prisma.energieEindafrekeningClaim.findUnique({
    where: { id: claimId },
    select: { userId: true, provider: true, createdAt: true },
  });
  if (!c || c.userId !== userId) return { ok: false };
  return {
    ok: true,
    zaak: `${c.provider} — claim ${c.createdAt.toISOString().slice(0, 10)}`,
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!isEnabled("VOLMACHT_SES_ENABLED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }
  if (!isVolmachtClaimType(params.claimType)) {
    return NextResponse.json({ error: "Onbekend claim-type." }, { status: 400 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const userName = (session.user as { name?: string | null }).name ?? "";
  const claimType = params.claimType as VolmachtClaimType;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Verwacht multipart/form-data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand meegestuurd." }, { status: 400 });
  }

  // Hergebruik documents-validation (zelfde regels: PDF/JPG/PNG, max 10MB).
  const validation = validateUpload({
    kind: "overig",
    filename: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const claim = await getClaimInfo(claimType, params.claimId, userId);
  if (!claim.ok) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  // Reject als er al een ondertekende volmacht ligt (niet gerevoceerd).
  const existing = await prisma.volmacht.findUnique({
    where: {
      claimType_claimId: { claimType, claimId: params.claimId },
    },
    select: {
      id: true,
      revokedAt: true,
      signedDocumentUrl: true,
    },
  });
  if (existing && !existing.revokedAt && existing.signedDocumentUrl) {
    return NextResponse.json(
      { error: "Er is al een ondertekend volmacht-formulier voor deze claim." },
      { status: 409 },
    );
  }

  // Upload naar Vercel Blob private store.
  const safeName = validation.filename.replace(/[/\\]/g, "_").replace(/\.\./g, "__");
  const path = `volmachten/${userId}/${claimType}/${params.claimId}/${Date.now()}-${safeName}`;
  let storageUrl: string;
  try {
    const blob = await put(path, file, {
      access: "private",
      contentType: validation.mimeType,
      addRandomSuffix: true,
    });
    storageUrl = blob.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "blob upload failed";
    return NextResponse.json({ error: `Upload mislukt: ${msg}` }, { status: 502 });
  }

  // Bouw mandate-text voor audit-trail (zelfde tekst die in het PDF staat).
  const mandateText = volmachtMandateText(claimType, userName || "[klant]");
  const ipH = hashIp(ipFromRequest(req));
  const userAgent = req.headers.get("user-agent") ?? null;

  // Upsert: als er al een SES-only volmacht ligt, vul dan de paper-velden aan.
  // Anders maak een nieuwe row met SES- + paper-evidence ineens.
  const volmacht = existing
    ? await prisma.volmacht.update({
        where: { id: existing.id },
        data: {
          signedDocumentUrl: storageUrl,
          signedDocumentFilename: validation.filename,
          signedDocumentUploadedAt: new Date(),
          zaakIdentifier: claim.zaak,
          revokedAt: null,
        },
        select: { id: true, signedDocumentUploadedAt: true },
      })
    : await prisma.volmacht.create({
        data: {
          userId,
          claimType,
          claimId: params.claimId,
          fullName: userName || "[klant]",
          templateVersion: VOLMACHT_TEMPLATE_VERSION,
          mandateText,
          ipHash: ipH,
          userAgent,
          signedDocumentUrl: storageUrl,
          signedDocumentFilename: validation.filename,
          signedDocumentUploadedAt: new Date(),
          zaakIdentifier: claim.zaak,
        },
        select: { id: true, signedDocumentUploadedAt: true },
      });

  return NextResponse.json({ ok: true, volmacht }, { status: 201 });
}
