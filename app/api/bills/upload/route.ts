import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractBill, hashImage, parseInvoiceDate, validateUploadedFile } from "@/lib/ocr";
import { currencyForCountry } from "@/lib/format";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

export async function POST(req: NextRequest) {
  let stage: "auth" | "form" | "validate" | "hash" | "cache" | "ocr" | "db" = "auth";
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      console.error("[upload] session.user.id missing", { user: session.user });
      return NextResponse.json(
        { error: "Sessie ongeldig — log opnieuw in" },
        { status: 401 },
      );
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
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    stage = "hash";
    const buf = Buffer.from(await file.arrayBuffer());
    const rawHash = hashImage(buf);
    const imageHash = userScopedHash(rawHash, userId);

    stage = "cache";
    // Per-user cache: if the same user uploaded the same file before AND OCR
    // succeeded, skip re-running Groq Vision. If the previous OCR was empty
    // (provider "Onbekend" or amount 0), fall through and re-OCR — otherwise
    // the user gets stuck on a blank analysis page forever.
    const cached = await prisma.bill.findUnique({ where: { imageHash } });
    if (cached && isBillUsable(cached)) {
      return NextResponse.json({ ok: true, billId: cached.id, cached: true });
    }

    stage = "ocr";
    const ocr = await extractBill(buf, file.type);

    stage = "db";
    let bill;
    if (cached) {
      // Same image, same user, previous attempt unusable → update in place so
      // we don't blow up the UNIQUE(imageHash) constraint on create().
      bill = await prisma.bill.update({
        where: { id: cached.id },
        data: {
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
        },
      });
    } else {
      bill = await prisma.bill.create({
        data: {
          userId,
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
          imageHash,
          rawOcr: ocr.rawText.slice(0, 4000),
        },
      });
    }

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
      {
        error: `Upload fout (${stage}): ${err.message}`,
        stage,
      },
      { status: 500 },
    );
  }
}
