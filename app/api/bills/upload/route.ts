import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractBill, hashImage, validateUploadedFile, pdfFallbackMessage } from "@/lib/ocr";
import * as Sentry from "@sentry/nextjs";
import { rateLimit, rateLimitResponse, ipFromRequest } from "@/lib/rate-limit";
import { anonymizeStructured } from "@/lib/anonymizer";
import { billDataFromOcr } from "@/lib/bill-from-ocr";
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
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      // v16: malformed/empty body throws inside formData(). Collapse
      // to a clean 400 so the route never 500s on bot/probe POSTs.
      return NextResponse.json(
        { error: "Ongeldig formulier — geen multipart-body" },
        { status: 400 },
      );
    }
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

    // v15.4: a cache hit only counts if the bill is *still* owned by the
    // current session. After magic-link claim, anonymous bills get
    // reassigned (anonymousSessionId → null, userId set) — but the
    // imageHash stays put because it was computed before the claim. The
    // same incognito window re-uploading the same file would otherwise
    // find a bill it can no longer view, get redirected back to
    // /onderhandel by the analyse page, and appear to do nothing.
    const ownedByCurrentSession =
      !!cached &&
      (userId
        ? cached.userId === userId
        : cached.anonymousSessionId === anonSessionId);
    const cachedOwned = ownedByCurrentSession ? cached : null;

    if (cachedOwned && isBillUsable(cachedOwned)) {
      const resp = NextResponse.json({ ok: true, billId: cachedOwned.id, cached: true });
      if (setCookieAfter && anonSessionId) {
        resp.cookies.set(ANON_COOKIE_NAME, anonSessionId, ANON_COOKIE_OPTIONS);
      }
      return resp;
    }

    stage = "ocr";
    const ocr = await extractBill(buf, file.type);

    stage = "db";
    // If a bill exists under this imageHash but belongs to someone else
    // (e.g. previously-anonymous bill claimed by the magic-link flow),
    // we cannot reuse the hash on a fresh insert without violating the
    // global UNIQUE(imageHash) constraint. Append random bytes so the
    // new record gets its own slot; dedup is sacrificed in this rare
    // post-claim re-upload case but data isolation stays intact.
    const persistHash = !cached || ownedByCurrentSession
      ? imageHash
      : `${imageHash}:${crypto.randomBytes(8).toString("hex")}`;
    const bill = await persistBill({
      userId,
      anonymousSessionId: isAnonymous ? anonSessionId : null,
      ocr,
      imageHash: persistHash,
      // Only treat as "update existing" when the existing record really
      // belongs to the current session/user.
      cached: cachedOwned,
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
