/**
 * GET /api/admin/volmacht/[claimType]/[claimId]/file — v37.
 *
 * Admin-gated proxy om de getekende volmacht-scan van een klant te
 * downloaden. Aparte route van de user-versie (/api/volmacht/.../signed-file)
 * omdat die op claim-ownership gate't; admins zijn geen owner van de claim.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";
import { isVolmachtClaimType } from "@/lib/volmacht";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { claimType: string; claimId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isVolmachtClaimType(params.claimType)) {
    return NextResponse.json({ error: "Onbekend claim-type." }, { status: 400 });
  }

  const v = await prisma.volmacht.findUnique({
    where: {
      claimType_claimId: { claimType: params.claimType, claimId: params.claimId },
    },
    select: { signedDocumentUrl: true, signedDocumentFilename: true },
  });
  if (!v || !v.signedDocumentUrl) {
    return NextResponse.json({ error: "Geen volmacht-scan." }, { status: 404 });
  }

  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(v.signedDocumentUrl, { access: "private" });
  } catch {
    return NextResponse.json(
      { error: "Volmacht kon niet worden opgehaald." },
      { status: 502 },
    );
  }
  if (!result || result.statusCode !== 200 || result.stream == null) {
    return NextResponse.json({ error: "Volmacht niet beschikbaar." }, { status: 404 });
  }

  const filename = (v.signedDocumentFilename ?? "volmacht.pdf").replace(/"/g, "");
  const contentType = result.blob.contentType ?? "application/pdf";
  return new Response(result.stream, {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
