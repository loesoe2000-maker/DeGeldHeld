/**
 * POST /api/account/documents/upload — v36 idee 4.
 *
 * Auth-gated + flag-gated. Verwacht multipart/form-data met:
 *   - file (binary)
 *   - kind (DocumentKind string)
 *   - note (optional, max 500 chars)
 *
 * Validatie via lib/user-documents.validateUpload. Storage via Vercel Blob
 * (`@vercel/blob.put`). Persisteert UserDocument-row met de blob-URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";
import {
  validateUpload,
  buildBlobPath,
  type DocumentKind,
} from "@/lib/user-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Flag-gate eerst → minder werk voor disabled deployments.
  if (!isEnabled("DOCUMENTS_VAULT_ENABLED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
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
    return NextResponse.json(
      { error: "Verwacht multipart/form-data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const noteRaw = form.get("note");
  const note = typeof noteRaw === "string" ? noteRaw.trim() : null;

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Geen bestand meegestuurd." },
      { status: 400 },
    );
  }

  const validation = validateUpload({
    kind,
    filename: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    note,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Vercel Blob upload — `access: "private"` zodat de blob alléén achter een
  // auth-gate ge-download kan worden. De download-flow loopt via onze proxy-
  // route (`GET /api/account/documents/[id]/file`) die ownership controleert
  // en de bytes server-side streamt — de blob-URL zelf wordt nooit aan de
  // client gegeven.
  const path = buildBlobPath(userId, validation.filename);
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
    return NextResponse.json(
      { error: `Upload mislukt: ${msg}` },
      { status: 502 },
    );
  }

  const doc = await prisma.userDocument.create({
    data: {
      userId,
      kind: validation.kind as DocumentKind,
      filename: validation.filename,
      sizeBytes: file.size,
      mimeType: validation.mimeType,
      storageUrl,
      note: note && note.length > 0 ? note : null,
    },
    select: { id: true, kind: true, filename: true, sizeBytes: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, document: doc }, { status: 201 });
}
