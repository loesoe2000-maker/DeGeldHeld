/**
 * GET /api/account/documents/[id]/file — v36 idee 4 (private-store fix).
 *
 * Auth-gated proxy-download. Vercel Blob is `access: "private"`, dus de
 * blob-URL is niet anoniem op te halen. Deze route:
 *   - verifieert sessie + ownership van het document
 *   - haalt de blob server-side op (BLOB_READ_WRITE_TOKEN-authenticated)
 *   - streamt de bytes met het juiste content-type terug naar de browser
 *
 * De rauwe blob-URL verlaat onze server nooit — alleen de owner ziet de
 * inhoud via deze auth-gated route.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
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
    select: { id: true, userId: true, storageUrl: true, mimeType: true, filename: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  // 404 i.p.v. 403 zodat we andermans document-IDs niet bevestigen.
  if (doc.userId !== userId) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(doc.storageUrl, { access: "private" });
  } catch {
    return NextResponse.json(
      { error: "Bestand kon niet worden opgehaald." },
      { status: 502 },
    );
  }
  if (!result) {
    return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
  }
  // We sturen geen If-None-Match dus 304 is praktisch onmogelijk, maar
  // TypeScript wil dat we de discriminated union narrowen.
  if (result.statusCode !== 200 || result.stream == null) {
    return NextResponse.json(
      { error: "Bestand niet beschikbaar (304 zonder body)." },
      { status: 502 },
    );
  }

  // Stream de bytes door zodat de blob-URL nooit aan de client wordt
  // blootgesteld. inline disposition zodat PDF/JPG/PNG in de browser opent.
  const safeFilename = doc.filename.replace(/"/g, "");
  return new Response(result.stream, {
    headers: {
      "content-type": doc.mimeType,
      "content-disposition": `inline; filename="${safeFilename}"`,
      // Voorkom dat tussenliggende caches deze auth-gated content opslaan.
      "cache-control": "private, no-store",
    },
  });
}
