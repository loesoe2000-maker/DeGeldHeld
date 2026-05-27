/**
 * GET /api/volmacht/[claimType]/[claimId]/form — v36 idee 2 (papier-flow).
 *
 * Genereert on-the-fly een voorgevuld machtigings-PDF. Auth-gated + flag-
 * gated + ownership-check op de claim. De zaak-identifier komt uit de claim
 * zelf (boekjaar voor huur, "<provider> eindafrekening" voor energie).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { isVolmachtClaimType, type VolmachtClaimType } from "@/lib/volmacht";
import { generateVolmachtPdf } from "@/lib/volmacht-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { claimType: string; claimId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
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
  const userEmail = (session.user as { email?: string | null }).email ?? "";
  const userName = (session.user as { name?: string | null }).name ?? "";

  if (!userName || userName.trim().length < 2) {
    return NextResponse.json(
      {
        error:
          "Vul eerst je volledige naam in via Mijn account voordat je de volmacht downloadt.",
      },
      { status: 400 },
    );
  }

  const claimType = params.claimType as VolmachtClaimType;

  // Ophalen claim + opbouwen zaak-identifier.
  let zaakIdentifier: string | null = null;
  if (claimType === "HuurServicekostenClaim") {
    const c = await prisma.huurServicekostenClaim.findUnique({
      where: { id: params.claimId },
      select: { userId: true, boekjaar: true, verhuurderNaam: true },
    });
    if (!c || c.userId !== userId) {
      return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
    }
    zaakIdentifier = `${c.boekjaar}${c.verhuurderNaam ? ` (${c.verhuurderNaam})` : ""}`;
  } else {
    const c = await prisma.energieEindafrekeningClaim.findUnique({
      where: { id: params.claimId },
      select: { userId: true, provider: true, createdAt: true },
    });
    if (!c || c.userId !== userId) {
      return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
    }
    zaakIdentifier = `${c.provider} — claim ${c.createdAt.toISOString().slice(0, 10)}`;
  }

  const pdfBytes = await generateVolmachtPdf({
    claimType,
    klant: {
      fullName: userName,
      email: userEmail,
      address: null, // klant vult met de hand in op het papier
    },
    zaakIdentifier: zaakIdentifier ?? "(onbekend)",
    uitgifteDatum: new Date(),
  });

  const filename = `volmacht-${claimType}-${params.claimId.slice(0, 8)}.pdf`;
  // Convert Uint8Array → ArrayBuffer slice (Response wil BodyInit).
  const ab = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
