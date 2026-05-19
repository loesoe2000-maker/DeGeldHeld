import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractBill, hashImage, parseInvoiceDate, validateUploadedFile, pdfFallbackMessage } from "@/lib/ocr";
import * as Sentry from "@sentry/nextjs";
import { currencyForCountry } from "@/lib/format";
import { rateLimit, rateLimitResponse, ipFromRequest } from "@/lib/rate-limit";
import { anonymizeStructured } from "@/lib/anonymizer";
import { inferSubType } from "@/lib/categories";
import {
  ANON_COOKIE_NAME,
  ANON_COOKIE_OPTIONS,
  generateAnonSessionId,
  isValidAnonSessionId,
} from "@/lib/anon-session";
import { verifyTurnstileToken } from "@/lib/turnstile";

// imageHash has a global UNIQUE constraint in the schema, so two users
// uploading the same file would collide. Scope the stored hash to (user, file)
// so dedup works per-user and a second user's upload still gets a fresh record.
function userScopedHash(rawHash: string, scope: string): string {
  return crypto.createHash("sha256").update(`${scope}:${rawHash}`).digest("hex");
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
  const subType =
    ocr.subType ??
    (ocr.category ? inferSubType(ocr.category, ocr.provider ?? "") : null) ??
    null;
  return {
    provider: ocr.provider ?? "Onbekend",
    category: ocr.category ?? "OVERIG",
    subType,
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
  userId: string | null;
  anonymousSessionId: string | null;
  ocr: OcrFields;
  imageHash: string;
  cached: { id: string } | null;
}) {
  const data = billDataFromOcr(opts.ocr);
  if (opts.cached) {
    // Same image, same scope, previous attempt unusable → update in place so
    // we don't blow up the UNIQUE(imageHash) constraint on create().
    return prisma.bill.update({ where: { id: opts.cached.id }, data });
  }
  // First-time persist: paywall position = prior-bill count;
  // schedule first re-check 30d out (DEEL 2 v8).
  // For anonymous bills the position+recheck are bookkeeping that
  // matters only after claim — set sane defaults.
  const priorBills = opts.userId
    ? await prisma.bill.count({ where: { userId: opts.userId } })
    : 0;
  return prisma.bill.create({
    data: {
      userId: opts.userId,
      anonymousSessionId: opts.anonymousSessionId,
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
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const isAnonymous = !userId;

    // v11 anti-fraud: suspended users keep their session for support but
    // cannot upload new bills until an admin un-suspends them.
    if (userId) {
      const userRow = await prisma.user.findUnique({
        where: { id: userId },
        select: { suspendedAt: true },
      });
      if (userRow?.suspendedAt) {
        return NextResponse.json(
          {
            error:
              "Je account staat onder review. Neem contact op via hallo@degeldheld.com.",
          },
          { status: 403 },
        );
      }
    }

    // v15 anonymous flow: read or mint a session cookie + verify
    // Turnstile + apply IP rate-limit. Logged-in users keep the
    // existing per-user limit and skip Turnstile.
    const cookieStore = await cookies();
    let anonSessionId: string | null = null;
    let setCookieAfter = false;
    if (isAnonymous) {
      const existing = cookieStore.get(ANON_COOKIE_NAME)?.value;
      anonSessionId = isValidAnonSessionId(existing) ? existing! : generateAnonSessionId();
      if (anonSessionId !== existing) setCookieAfter = true;
    }

    const rl = isAnonymous
      ? rateLimit({
          key: `upload-anon:${ipFromRequest(req)}`,
          max: 3,
          windowSec: 3600,
        })
      : rateLimit({ key: `upload:${userId}`, max: 5, windowSec: 3600 });
    if (!rl.ok) return rateLimitResponse(rl);

    stage = "form";
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Geen bestand bijgevoegd" }, { status: 400 });
    }

    // v15: anonymous uploads must pass Turnstile (graceful fallback in
    // dev / unconfigured prod — see lib/turnstile.ts).
    if (isAnonymous) {
      const turnstileToken = (form.get("turnstileToken") ?? "") as string;
      const verdict = await verifyTurnstileToken(turnstileToken, ipFromRequest(req));
      if (!verdict.ok) {
        return NextResponse.json(
          { error: "Bot-controle gefaald — vernieuw de pagina en probeer opnieuw." },
          { status: 400 },
        );
      }
    }

    stage = "validate";
    const validation = validateUploadedFile({ size: file.size, type: file.type });
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

    stage = "hash";
    const buf = Buffer.from(await file.arrayBuffer());
    // Scope cache-key to the owning identifier — userId when signed in,
    // anonSessionId when anonymous. Prevents cross-user collisions.
    const hashScope = userId ?? `anon:${anonSessionId ?? "no-session"}`;
    const imageHash = userScopedHash(hashImage(buf), hashScope);

    stage = "cache";
    const cached = await prisma.bill.findUnique({ where: { imageHash } });
    if (cached && isBillUsable(cached)) {
      const resp = NextResponse.json({ ok: true, billId: cached.id, cached: true });
      if (setCookieAfter && anonSessionId) {
        resp.cookies.set(ANON_COOKIE_NAME, anonSessionId, ANON_COOKIE_OPTIONS);
      }
      return resp;
    }

    stage = "ocr";
    const ocr = await extractBill(buf, file.type);

    stage = "db";
    const bill = await persistBill({
      userId,
      anonymousSessionId: isAnonymous ? anonSessionId : null,
      ocr,
      imageHash,
      cached,
    });
    if (userId) {
      await collectTrainingSampleIfOptIn({
        userId,
        ocr,
        billCategory: bill.category,
        billCountry: bill.country,
      });
    }

    const pdfMessage = file.type.toLowerCase() === "application/pdf"
      ? pdfFallbackMessage(ocr.rawText)
      : null;

    const resp = NextResponse.json({
      ok: ocr.ok,
      billId: bill.id,
      anonymous: isAnonymous,
      needsManual: ocr.needsManual ?? !ocr.ok,
      needsManualProvider: ocr.needsManualProvider ?? false,
      pdfMessage,
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
    if (setCookieAfter && anonSessionId) {
      resp.cookies.set(ANON_COOKIE_NAME, anonSessionId, ANON_COOKIE_OPTIONS);
    }
    return resp;
  } catch (e) {
    const err = e as Error;
    console.error(`[upload] crash at stage=${stage}:`, err.message, err.stack);
    Sentry.captureException(err, { tags: { route: "bills/upload", stage } });
    return NextResponse.json(
      { error: `Upload fout (${stage}): ${err.message}`, stage },
      { status: 500 },
    );
  }
}
