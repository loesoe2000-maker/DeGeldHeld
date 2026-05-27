/**
 * DELETE /api/account/documents/[id] — v36 idee 4.
 *
 * Auth-gated. Verwijdert eerst de Vercel Blob (best-effort: als blob al
 * weg is, gaan we door met de DB-delete), daarna de UserDocument-row.
 * Ownership-check: een user kan alleen z'n eigen documenten verwijderen.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isEnabled("DOCUMENTS_VAULT_ENABLED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const doc = await prisma.userDocument.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, storageUrl: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  // Ownership-gate — 404 i.p.v. 403 om bestaan van andermans IDs niet te
  // bevestigen.
  if (doc.userId !== userId) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  // Blob delete best-effort: faalt? log + door met DB-cleanup zodat de
  // gebruiker zijn record geen "ghost-row" houdt.
  try {
    await del(doc.storageUrl);
  } catch {
    // Bewust geslikt — de DB-row wordt sowieso verwijderd.
  }

  await prisma.userDocument.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true });
}
