import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractBill, hashImage, parseInvoiceDate, validateUploadedFile } from "@/lib/ocr";
import { currencyForCountry } from "@/lib/format";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { anonymizeStructured } from "@/lib/anonymizer";

// imageHash has a global UNIQUE constraint in the schema, so two users
// uploading the same file would collide. Scope the stored hash to (user, file)
// so dedup works per-user and a second user's upload still gets a fresh record.
function userScopedHash(rawHash: string, userId: string): string {
  return crypto.createHash("sha256").update(`${userId}:${rawHash}`).digest("hex");
}

// A bill is considered "usable" if OCR actually got a real provider and amount,
// AND it was extracted against the current OCR schema (monthlyCents OR invoiceDate
// populated — pre-v4 records have both null, so force a re-OCR to fill them in).
function isBillUsable(b: {
  provider: string;
  amountCents: number;
  monthlyCents?: number | null;
  invoiceDate?: Date | null;
}): boolean {
  if (b.amountCents <= 0) return false;
  if (b.provider === "Onbekend" || b.provider === "") return false;
  if (b.monthlyCents == null && b.invoiceDate == null) return false;
  return true;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Groq Vision (90b + retry + 11b fallback) can take up to ~30s on a slow image.
// Vercel hobby default is 10s → causes 504 → client shows "Netwerkfout".
// Hobby plan max is 60s. Pro plan can go to 300s.
export const maxDuration = 60;

type OcrFields = Awaited<ReturnType<typeof extractBill>>;

function billDataFromOcr(ocr: OcrFields) {
  return {
    provider: ocr.provider ?? "Onbekend",
    category: ocr.category ?? "OVERIG",
    amountCents: ocr.amountCents ?? 0,
    monthlyCents: ocr.monthlyAmountCents,
    totalCents: ocr.totalAmountCents,
    plan: ocr.plan,
    period: ocr.period,
    invoiceDate: parseInvoiceDate(ocr.period),
    customerNumber: ocr.customerNumber,
    country: ocr.country ?? undefined,
    currency: currencyForCountry(ocr.country),
    rawOcr: ocr.rawText.slice(0, 4000),
  };
}

async function persistBill(opts: {
  userId: string;
  ocr: OcrFields;
  imageHash: string;
  cached: { id: string } | null;
}) {
  const data = billDataFromOcr(opts.ocr);
  if (opts.cached) {
    // Same image, same user, previous attempt unusable → update in place so
    // we don't blow up the UNIQUE(imageHash) constraint on create().
    return prisma.bill.update({ where: { id: opts.cached.id }, data });
  }
  // First-time persist: paywall position = prior-bill count;
  // schedule first re-check 30d out (DEEL 2 v8).
  const priorBills = await prisma.bill.count({ where: { userId: opts.userId } });
  return prisma.bill.create({
    data: {
      userId: opts.userId,
      ...data,
      imageHash: opts.imageHash,
      position: priorBills,
      nextRecheckAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

async function collectTrainingSampleIfOptIn(opts: {
  userId: string;
  ocr: OcrFields;
  billCategory: string;
  billCountry: string | null;
}) {
  if (!opts.ocr.ok || !opts.ocr.provider || !opts.ocr.amountCents) return;
  try {
    const u = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { ocrTrainingOptIn: true },
    });
    if (!u?.ocrTrainingOptIn) return;
    const sample = anonymizeStructured({
      provider: opts.ocr.provider,
      category: opts.ocr.category,
      amountCents: opts.ocr.amountCents,
      monthlyAmountCents: opts.ocr.monthlyAmountCents,
      totalAmountCents: opts.ocr.totalAmountCents,
      plan: opts.ocr.plan,
      period: opts.ocr.period,
      customerNumber: opts.ocr.customerNumber,
      language: opts.ocr.language,
      country: opts.ocr.country,
      rawText: opts.ocr.rawText.slice(0, 4000),
    });
    await prisma.ocrTrainingSample.create({
      data: {
        userId: opts.userId,
        imageStorageUrl: null,
        anonymizedJson: JSON.stringify(sample),
        billCategory: opts.billCategory,
        country: opts.billCountry ?? "NL",
      },
    });
  } catch {
    // never block the upload on training-collection failures
  }
}

export async function POST(req: NextRequest) {
  let stage: "auth" | "form" | "validate" | "hash" | "cache" | "ocr" | "db" = "auth";
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      console.error("[upload] session.user.id missing", { user: session.user });
      return NextResponse.json({ error: "Sessie ongeldig — log opnieuw in" }, { status: 401 });
    }

    const rl = rateLimit({ key: `upload:${userId}`, max: 5, windowSec: 3600 });
    if (!rl.ok) return rateLimitResponse(rl);

    stage = "form";
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Geen bestand bijgevoegd" }, { status: 400 });
    }

    stage = "validate";
    const validation = validateUploadedFile({ size: file.size, type: file.type });
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

    stage = "hash";
    const buf = Buffer.from(await file.arrayBuffer());
    const imageHash = userScopedHash(hashImage(buf), userId);

    stage = "cache";
    const cached = await prisma.bill.findUnique({ where: { imageHash } });
    if (cached && isBillUsable(cached)) {
      return NextResponse.json({ ok: true, billId: cached.id, cached: true });
    }

    stage = "ocr";
    const ocr = await extractBill(buf, file.type);

    stage = "db";
    const bill = await persistBill({ userId, ocr, imageHash, cached });
    await collectTrainingSampleIfOptIn({
      userId,
      ocr,
      billCategory: bill.category,
      billCountry: bill.country,
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
        monthlyAmountCents: ocr.monthlyAmountCents,
        totalAmountCents: ocr.totalAmountCents,
        oneTimeItems: ocr.oneTimeItems,
        plan: ocr.plan,
        period: ocr.period,
        customerNumber: ocr.customerNumber,
        language: ocr.language,
        country: ocr.country,
        confidence: ocr.confidence,
      },
    });
  } catch (e) {
    const err = e as Error;
    console.error(`[upload] crash at stage=${stage}:`, err.message, err.stack);
    return NextResponse.json(
      { error: `Upload fout (${stage}): ${err.message}`, stage },
      { status: 500 },
    );
  }
}
