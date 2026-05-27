/**
 * GET /api/volmacht/[claimType]/[claimId]/signed-file — v36 idee 2.
 *
 * Auth-gated proxy om de geüploade getekende volmacht-scan terug te
 * downloaden (alleen owner). Streamt server-side; de blob-URL verlaat
 * onze server nooit.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";
import { isVolmachtClaimType } from "@/lib/volmacht";

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

  const v = await prisma.volmacht.findUnique({
    where: {
      claimType_claimId: { claimType: params.claimType, claimId: params.claimId },
    },
    select: {
      userId: true,
      signedDocumentUrl: true,
      signedDocumentFilename: true,
    },
  });
  if (!v || v.userId !== userId || !v.signedDocumentUrl) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(v.signedDocumentUrl, { access: "private" });
  } catch {
    return NextResponse.json(
      { error: "Bestand kon niet worden opgehaald." },
      { status: 502 },
    );
  }
  if (!result || result.statusCode !== 200 || result.stream == null) {
    return NextResponse.json({ error: "Bestand niet beschikbaar." }, { status: 404 });
  }

  const filename = (v.signedDocumentFilename ?? "volmacht.pdf").replace(/"/g, "");
  // Probeer het content-type af te leiden uit blob-metadata; val terug op pdf.
  const contentType = result.blob.contentType ?? "application/pdf";
  return new Response(result.stream, {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
