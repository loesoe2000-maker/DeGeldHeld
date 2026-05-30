/**
 * GET /api/admin/claims/[type]/[id]/proof — v37.
 *
 * Admin-gated proxy om het opgeslagen bewijs-document van een claim te
 * downloaden (Box 3-beschikking of Huur-/Energie-uitspraak). De blob is
 * private; deze route streamt server-side zodat de URL nooit lekt.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";
import { isClaimType, type ClaimType } from "@/lib/admin-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { type: string; id: string } };

async function resolveStorageUrl(
  type: ClaimType,
  id: string,
): Promise<string | null> {
  if (type === "Box3Claim") {
    const c = await prisma.box3Claim.findUnique({
      where: { id },
      select: { proofStorageUrl: true },
    });
    return c?.proofStorageUrl ?? null;
  }
  if (type === "HuurServicekostenClaim") {
    const c = await prisma.huurServicekostenClaim.findUnique({
      where: { id },
      select: { uitspraakStorageUrl: true },
    });
    return c?.uitspraakStorageUrl ?? null;
  }
  const c = await prisma.energieEindafrekeningClaim.findUnique({
    where: { id },
    select: { uitspraakStorageUrl: true },
  });
  return c?.uitspraakStorageUrl ?? null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isClaimType(params.type)) {
    return NextResponse.json({ error: "Onbekend claim-type." }, { status: 400 });
  }

  const url = await resolveStorageUrl(params.type, params.id);
  if (!url) {
    return NextResponse.json(
      { error: "Geen bewijs opgeslagen voor deze claim." },
      { status: 404 },
    );
  }

  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(url, { access: "private" });
  } catch {
    return NextResponse.json(
      { error: "Bewijs kon niet worden opgehaald." },
      { status: 502 },
    );
  }
  if (!result || result.statusCode !== 200 || result.stream == null) {
    return NextResponse.json({ error: "Bewijs niet beschikbaar." }, { status: 404 });
  }

  const contentType = result.blob.contentType ?? "application/octet-stream";
  return new Response(result.stream, {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="bewijs-${params.id.slice(0, 8)}"`,
      "cache-control": "private, no-store",
    },
  });
}
