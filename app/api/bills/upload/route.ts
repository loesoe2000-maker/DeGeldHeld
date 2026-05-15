import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractBill, hashImage, validateUploadedFile } from "@/lib/ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Groq Vision (90b + retry + 11b fallback) can take up to ~30s on a slow image.
// Vercel hobby default is 10s → causes 504 → client shows "Netwerkfout".
// Hobby plan max is 60s. Pro plan can go to 300s.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand bijgevoegd" }, { status: 400 });
  }

  const validation = validateUploadedFile({ size: file.size, type: file.type });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const imageHash = hashImage(buf);

  // Cache: don't re-OCR same image within 30 days
  const cached = await prisma.bill.findUnique({ where: { imageHash } });
  if (cached && cached.userId === userId) {
    return NextResponse.json({ ok: true, billId: cached.id, cached: true });
  }

  const ocr = await extractBill(buf, file.type);

  const bill = await prisma.bill.create({
    data: {
      userId,
      provider: ocr.provider ?? "Onbekend",
      category: ocr.category ?? "OVERIG",
      amountCents: ocr.amountCents ?? 0,
      plan: ocr.plan,
      period: ocr.period,
      imageHash,
      rawOcr: ocr.rawText.slice(0, 4000),
    },
  });

  return NextResponse.json({
    ok: ocr.ok,
    billId: bill.id,
    needsManual: ocr.needsManual ?? !ocr.ok,
    needsManualProvider: ocr.needsManualProvider ?? false,
    extracted: {
      provider: ocr.provider,
      category: ocr.category,
      amountCents: ocr.amountCents,
      plan: ocr.plan,
      period: ocr.period,
      customerNumber: ocr.customerNumber,
      language: ocr.language,
      confidence: ocr.confidence,
    },
  });
}
