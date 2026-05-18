/**
 * Bill OCR via Groq Vision met model cascade + retry + 30-dag cache.
 *
 * v3 upgrades:
 *  - Dynamische prompt extract ANY provider (geen hardcoded lijst meer in prompt)
 *  - Multi-language support: NL/EN/DE bills
 *  - Extra extract velden: customerNumber, address (best-effort)
 *  - imageHash → ocrCache 30 dagen (geen dubbele Groq-call voor zelfde foto)
 *  - Unknown provider: ok=true + needsManualProvider=true (caller toont dropdown)
 *  - 1× exponential-backoff retry per model bij transient error
 */

import Groq from "groq-sdk";
import crypto from "node:crypto";
import { findProvider, providerCountry, type Category, type Country } from "@/lib/providers";
import { primaryFromLegacy, type PrimaryCategory } from "@/lib/categories";
import { ocrCache } from "@/lib/llm_cache";
import { extractPdfText } from "@/lib/pdf_extract";

// Groq free-tier text model (only allowed for non-vision):
const TEXT_MODEL = "llama-3.3-70b-versatile";

export type OcrResult = {
  ok: boolean;
  provider: string | null;
  category: Category | null;
  /** Vast maand-abonnement in cents (zonder eenmalige posten).
   *  Default voor vergelijking met markt-prijzen. */
  monthlyAmountCents: number | null;
  /** Volledig factuur-totaal in cents (incl. eenmalige posten zoals
   *  online aankopen, eenmalige verhuiskosten, etc). */
  totalAmountCents: number | null;
  /** Backwards-compat: gelijk aan monthlyAmountCents ?? totalAmountCents */
  amountCents: number | null;
  /** Labels van eenmalige posten (online aankopen, etc) — lege array bij
   *  pure abonnementsfactuur. */
  oneTimeItems: string[];
  plan: string | null;
  period: string | null;
  customerNumber: string | null;
  language: "nl" | "en" | "de" | "unknown";
  /** Detected country from valuta/address/language. Null when uncertain. */
  country: Country | null;
  /** v10: primary category (7 buckets). Falls back to primaryFromLegacy
   * mapping of `category` when LLM didn't return it explicitly. */
  primaryCategory?: PrimaryCategory | null;
  /** v10: free-form sub-type ("stroom+gas", "mobiel", "auto"). */
  subType?: string | null;
  /** Optional category-specific extras — only populated when OCR was confident. */
  energyKwhRateCents?: number | null;     // ENERGIE: cent per kWh
  energyM3RateCents?: number | null;      // ENERGIE: cent per m³ gas
  insuranceCoverage?: string | null;      // VERZEKERING: WA/casco/uitgebreid
  insuranceDeductibleCents?: number | null; // VERZEKERING: eigen risico in cents
  mortgageInterestPct?: number | null;    // HYPOTHEEK: rentepercentage
  mortgageTermYears?: number | null;      // HYPOTHEEK: looptijd in jaren
  bankAccountTier?: string | null;        // BANK: pakketnaam
  streamingTier?: string | null;          // STREAMING: basic/standard/premium
  confidence: number; // 0..1
  rawText: string;
  imageHash: string;
  modelUsed?: string;
  attempts?: number;
  cached?: boolean;
  /** True wanneer OCR een provider naam vond maar deze niet matched
   *  in NL_PROVIDERS — UI moet dropdown tonen voor handmatige keuze. */
  needsManualProvider?: boolean;
  /** True wanneer hele extract faalde / te lage confidence — UI moet
   *  volledige handmatige invoer tonen. */
  needsManual?: boolean;
};

/**
 * Dynamic OCR prompt — multi-language, geen hardcoded provider lijst.
 * Asks model to extract whatever provider name appears, in any language.
 */
const SYSTEM_PROMPT = `Je bent een multilingual OCR-engine voor facturen (NL/EN/DE/FR/ES/IT).
De input kan meerdere pagina's van dezelfde factuur bevatten (jaarafrekeningen
hebben totaalbedrag op pagina 1 en specificatie op pagina 2-5). Pagina's
worden gescheiden met "--- page N ---" markers. Combineer informatie over
pagina's heen — het maandbedrag staat soms alleen op pagina 1, soms moet
het berekend worden uit jaartotaal + maanden op latere pagina's.

Lees de factuur en extracteer:
  - provider: bedrijfs-/leveranciersnaam (zoals afgedrukt, geen interpretatie)
  - monthly_subscription_eur: vaste maandelijkse abonnementsprijs in euro
    (number). Dit is het terugkerend bedrag — exclusief eenmalige posten
    zoals online aankopen, eenmalige verhuiskosten, of administratiekosten.
  - total_eur: volledig factuur-totaal in euro (number). Dit is het bedrag
    dat daadwerkelijk wordt afgeschreven. Gelijk aan monthly_subscription_eur
    als er geen eenmalige posten zijn.
  - one_time_items: array van strings met labels voor eenmalige posten
    (bv ["Online aankopen 4,99", "Verhuiskosten 25,00"]). Lege array
    als er geen eenmalige posten zijn.
  - plan: pakket-/tarief-/abonnementsnaam indien zichtbaar
  - period: factuur-periode (bv "mei 2026" of "2026-05")
  - customer_number: klantnummer / klant-id / Kundennummer / customer ID
  - primary_category: één van TELECOM, ENERGIE, VERZEKERING, WONEN,
    FINANCIEN, ABONNEMENTEN, OVERIG
  - sub_type: specifieker label, bv "stroom+gas", "mobiel", "auto",
    "hypotheek", "streaming". Null bij twijfel.
  - language: "nl" | "en" | "de" (auto-detect)
  - country: ISO-2-code van het land waar de factuur uit komt
    (NL/BE/DE/FR/UK/US/ES/IT). Gebruik valuta-symbool (€/£/$),
    adres, IBAN-prefix en taal als hints. null bij twijfel.
  - category-specifieke extras (alleen vullen indien duidelijk leesbaar,
    anders null):
      energy_kwh_rate_eur: prijs per kWh (energie-factuur)
      energy_m3_rate_eur: prijs per m³ gas (energie-factuur)
      insurance_coverage: dekking-type (WA/casco/uitgebreid)
      insurance_deductible_eur: eigen risico in euro
      mortgage_interest_pct: rente in procent (hypotheek-factuur)
      mortgage_term_years: looptijd in jaren
      bank_account_tier: pakket-/account-naam
      streaming_tier: tier basic/standard/premium
  - confidence: 0-1 (hoe zeker ben je over provider+amounts samen)

Belangrijke regels:
  - Verzin GEEN waarden — null bij twijfel
  - Provider naam exact zoals afgedrukt (niet vertalen, niet normaliseren)
  - Bij pure abonnementsfactuur: monthly_subscription_eur == total_eur en
    one_time_items = []
  - Bij factuur met eenmalige posten: monthly_subscription_eur < total_eur
    en one_time_items bevat de labels + bedragen
  - Antwoord ALLEEN in JSON, geen markdown, geen toelichting

Voorbeeld JSON output (KPN met eenmalige post):
{"provider":"KPN","monthly_subscription_eur":24.66,"total_eur":29.65,"one_time_items":["Online aankopen 4,99"],"plan":"Compleet","period":"mei 2026","customer_number":"12345678","language":"nl","primary_category":"TELECOM","sub_type":"mobiel","confidence":0.92}

Voorbeeld JSON output (Eneco stroom+gas):
{"provider":"Eneco","monthly_subscription_eur":140.00,"total_eur":140.00,"one_time_items":[],"plan":"HollandseWind","period":"mei 2026","customer_number":"33344","language":"nl","primary_category":"ENERGIE","sub_type":"stroom+gas","confidence":0.93}`;

// Groq free-tier whitelist (mei 2026):
//   - vision: meta-llama/llama-4-scout-17b-16e-instruct
//   - text:   llama-3.3-70b-versatile
// Override with GROQ_VISION_MODEL env var if a paid tier becomes available.
export const VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

const apiKey = process.env.GROQ_API_KEY ?? "";
const visionModelOverride = process.env.GROQ_VISION_MODEL;

let _client: Groq | null = null;
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey });
  return _client;
}

export function hashImage(buf: Uint8Array | Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function extractEurFromText(s: string): number | null {
  const m = /(?:€|EUR)?\s*([0-9]{1,4}(?:[.,][0-9]{2}))/i.exec(s);
  if (!m) return null;
  const num = Number(m[1].replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function detectLanguage(input: unknown): OcrResult["language"] {
  if (input === "nl" || input === "en" || input === "de") return input;
  return "unknown";
}

const VALID_COUNTRIES: Country[] = ["NL", "BE", "DE", "FR", "UK", "US", "ES", "IT", "INT"];

function detectCountry(input: unknown): Country | null {
  if (typeof input !== "string") return null;
  const upper = input.toUpperCase().trim();
  if (VALID_COUNTRIES.includes(upper as Country)) return upper as Country;
  // Common aliases
  if (upper === "GB" || upper === "GBR") return "UK";
  if (upper === "USA") return "US";
  if (upper === "DEU") return "DE";
  if (upper === "FRA") return "FR";
  if (upper === "NLD") return "NL";
  if (upper === "BEL") return "BE";
  if (upper === "ESP") return "ES";
  if (upper === "ITA") return "IT";
  return null;
}

const VALID_PRIMARIES: PrimaryCategory[] = [
  "TELECOM",
  "ENERGIE",
  "VERZEKERING",
  "WONEN",
  "FINANCIEN",
  "ABONNEMENTEN",
  "OVERIG",
];

function detectPrimary(input: unknown): PrimaryCategory | null {
  if (typeof input !== "string") return null;
  const upper = input.toUpperCase().trim();
  if (VALID_PRIMARIES.includes(upper as PrimaryCategory)) return upper as PrimaryCategory;
  return null;
}

/**
 * Parse een factuur-periode string naar een Date (1e van de maand, UTC).
 *
 * Ondersteunt:
 *  - NL maandnamen: "augustus 2020", "Augustus 2020", "aug 2020", "aug. 2020"
 *  - EN maandnamen: "August 2020", "Aug 2020"
 *  - DE maandnamen: "August 2020", "Aug 2020"  (overlap met EN voor mei/aug)
 *  - Pure DE: "Mai 2020", "Dezember 2020"
 *  - Numeriek: "2020-08", "2020/08", "08-2020", "08/2020", "8/2020", "8-2020"
 *
 * Returns null bij parse-fail. Geldigheids-check: maand 1-12.
 */
const MONTH_MAP: Record<string, number> = {
  // NL
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maart: 3, mrt: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  augustus: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
  // EN
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10,
  // DE
  mai: 5, dezember: 12, märz: 3, marz: 3,
};

export function parseInvoiceDate(period: string | null | undefined): Date | null {
  if (!period || typeof period !== "string") return null;
  const s = period.trim().toLowerCase().replace(/\./g, "");
  if (!s) return null;

  // 1. ISO-style: 2020-08, 2020-08-01, 2020/08
  let m = /^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/.exec(s);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
    return null;
  }

  // 2. Reverse numeric: 08-2020, 8/2020
  m = /^(\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
    return null;
  }

  // 3. Month name + year: "augustus 2020", "Aug 2020", "August 2020"
  m = /^([a-zäöü]+)[\s,]+(\d{4})$/.exec(s);
  if (m) {
    const name = m[1];
    const year = Number(m[2]);
    const month = MONTH_MAP[name];
    if (month != null && year >= 1900 && year <= 2100) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
    return null;
  }

  // 4. Year + month name: "2020 augustus" (rare but seen on DE invoices)
  m = /^(\d{4})[\s,]+([a-zäöü]+)$/.exec(s);
  if (m) {
    const year = Number(m[1]);
    const name = m[2];
    const month = MONTH_MAP[name];
    if (month != null && year >= 1900 && year <= 2100) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
    return null;
  }

  return null;
}

function toCents(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

export function parseOcrJson(raw: string): Partial<OcrResult> {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const provider = typeof obj.provider === "string" ? obj.provider : null;
    const plan = typeof obj.plan === "string" ? obj.plan : null;
    const period = typeof obj.period === "string" ? obj.period : null;
    const customerNumber = typeof obj.customer_number === "string" ? obj.customer_number : null;
    const confidence = typeof obj.confidence === "number" ? obj.confidence : 0;

    // v3.1: split monthly subscription vs full invoice total.
    // Backwards-compat: oude "amount_eur" wordt als monthly + total geïnterpreteerd.
    const monthlyCents = toCents(obj.monthly_subscription_eur);
    const totalCents = toCents(obj.total_eur);
    const legacyAmount = toCents(obj.amount_eur);

    // Llama 4 sometimes returns only `total_eur` (pure-subscription bill) or
    // only `monthly_subscription_eur` (model couldn't read the total line).
    // Fall back across all three so we never end up with a null comparison
    // amount when at least one bedrag was extracted.
    const monthlyAmountCents = monthlyCents ?? totalCents ?? legacyAmount;
    const totalAmountCents = totalCents ?? monthlyCents ?? legacyAmount;
    const amountCents = monthlyAmountCents ?? totalAmountCents;

    const oneTimeItems = Array.isArray(obj.one_time_items)
      ? (obj.one_time_items as unknown[]).filter((x): x is string => typeof x === "string")
      : [];

    function toCentsLoose(v: unknown): number | null {
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      return Math.round(v * 100);
    }
    function strOrNull(v: unknown): string | null {
      return typeof v === "string" && v.length > 0 ? v : null;
    }
    function numOrNull(v: unknown): number | null {
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }

    return {
      provider,
      monthlyAmountCents,
      totalAmountCents,
      amountCents,
      oneTimeItems,
      plan,
      period,
      customerNumber,
      language: detectLanguage(obj.language),
      country: detectCountry(obj.country),
      energyKwhRateCents: toCentsLoose(obj.energy_kwh_rate_eur),
      energyM3RateCents: toCentsLoose(obj.energy_m3_rate_eur),
      insuranceCoverage: strOrNull(obj.insurance_coverage),
      insuranceDeductibleCents: toCentsLoose(obj.insurance_deductible_eur),
      mortgageInterestPct: numOrNull(obj.mortgage_interest_pct),
      mortgageTermYears: numOrNull(obj.mortgage_term_years),
      bankAccountTier: strOrNull(obj.bank_account_tier),
      streamingTier: strOrNull(obj.streaming_tier),
      primaryCategory: detectPrimary(obj.primary_category),
      subType: strOrNull(obj.sub_type),
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  } catch {
    return { confidence: 0, language: "unknown", country: null, oneTimeItems: [] };
  }
}

/**
 * Vision call. Accepts ONE or MORE data-URLs so the same call site
 * can ship a single-image bill or a multi-page rendering of a PDF
 * (v12 DEEL 2). Llama-4 Scout/Maverick accept multi-image input.
 *
 * Cost-guard: caller is expected to cap pages to MAX_PDF_PAGES (5).
 */
async function tryModel(
  model: string,
  dataUrls: string | string[],
): Promise<{ raw: string; err?: Error }> {
  const urls = Array.isArray(dataUrls) ? dataUrls : [dataUrls];
  try {
    const resp = await client().chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SYSTEM_PROMPT },
            ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });
    return { raw: resp.choices[0]?.message?.content ?? "" };
  } catch (e) {
    return { raw: "", err: e as Error };
  }
}

/**
 * Text-LLM variant of tryModel — used for PDF tekst-extractie pad.
 * Input is the raw extracted text from page 1; model parses to the
 * same JSON schema as the vision flow.
 */
async function tryTextModel(
  model: string,
  pdfText: string,
): Promise<{ raw: string; err?: Error }> {
  try {
    const trimmed = pdfText.slice(0, 8000); // bound input tokens
    const resp = await client().chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Hier is de raw tekst-content van een factuur-PDF (pagina 1). Extract de velden volgens het schema. Tekst:\n\n${trimmed}`,
        },
      ],
      max_tokens: 600,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });
    return { raw: resp.choices[0]?.message?.content ?? "" };
  } catch (e) {
    return { raw: "", err: e as Error };
  }
}

/**
 * Try a model up to 2× with 1.5s exponential backoff on transient errors.
 * Returns first successful raw output, or last error.
 */
async function tryModelWithRetry(
  model: string,
  dataUrl: string,
): Promise<{ raw: string; err?: Error }> {
  const first = await tryModel(model, dataUrl);
  if (!first.err) return first;
  // transient errors: 429, 5xx, network
  const msg = first.err.message.toLowerCase();
  const isTransient = /429|503|502|504|timeout|econn|enot/.test(msg);
  if (!isTransient) return first;
  await new Promise((r) => setTimeout(r, 1500));
  return tryModel(model, dataUrl);
}

/**
 * E2E test hook: set GROQ_VISION_MOCK=1 om Groq Vision te bypassen.
 * Returnt een vaste KPN-factuur response zodat Playwright tests
 * geen echte API call hoeven (cost + flake control).
 */
function mockBillResponse(imageHash: string): OcrResult {
  return {
    ok: true,
    provider: "KPN",
    category: "TELECOM",
    primaryCategory: "TELECOM",
    subType: "mobiel",
    monthlyAmountCents: 2466,
    totalAmountCents: 2965,
    amountCents: 2466,
    oneTimeItems: ["Online aankopen 4,99"],
    plan: "Compleet",
    period: "mei 2026",
    customerNumber: "12345678",
    language: "nl",
    country: "NL",
    confidence: 0.95,
    rawText: "MOCKED",
    imageHash,
    modelUsed: "mock",
    attempts: 1,
  };
}

function emptyResult(imageHash: string): OcrResult {
  return {
    ok: false,
    provider: null,
    category: null,
    primaryCategory: null,
    subType: null,
    monthlyAmountCents: null,
    totalAmountCents: null,
    amountCents: null,
    oneTimeItems: [],
    plan: null,
    period: null,
    customerNumber: null,
    language: "unknown",
    country: null,
    confidence: 0,
    rawText: "",
    imageHash,
    attempts: 0,
  };
}

/**
 * Build a successful OcrResult from a parsed Groq response.
 * Centralises country derivation + field mapping so the PDF + Vision
 * paths can't drift apart.
 */
function buildSuccessResult(opts: {
  parsed: Partial<OcrResult>;
  imageHash: string;
  modelUsed: string;
  attempts: number;
  rawText: string;
  fromVision: boolean;
}): OcrResult {
  const { parsed } = opts;
  const matched = parsed.provider ? findProvider(parsed.provider) : null;
  const country: Country | null =
    parsed.country ?? (matched ? providerCountry(matched.canonical) : null);
  const category = matched?.category ?? null;
  const primary: PrimaryCategory | null =
    parsed.primaryCategory ?? (category ? primaryFromLegacy(category) : null);
  return {
    ok: true,
    provider: matched?.canonical ?? parsed.provider ?? null,
    category,
    primaryCategory: primary,
    subType: parsed.subType ?? null,
    monthlyAmountCents: parsed.monthlyAmountCents ?? parsed.amountCents ?? null,
    totalAmountCents: parsed.totalAmountCents ?? parsed.amountCents ?? null,
    amountCents:
      parsed.monthlyAmountCents ?? parsed.totalAmountCents ?? parsed.amountCents ?? null,
    oneTimeItems: parsed.oneTimeItems ?? [],
    plan: parsed.plan ?? null,
    period: parsed.period ?? null,
    customerNumber: parsed.customerNumber ?? null,
    language: parsed.language ?? "unknown",
    country,
    energyKwhRateCents: parsed.energyKwhRateCents ?? null,
    energyM3RateCents: parsed.energyM3RateCents ?? null,
    insuranceCoverage: parsed.insuranceCoverage ?? null,
    insuranceDeductibleCents: parsed.insuranceDeductibleCents ?? null,
    mortgageInterestPct: parsed.mortgageInterestPct ?? null,
    mortgageTermYears: parsed.mortgageTermYears ?? null,
    bankAccountTier: parsed.bankAccountTier ?? null,
    streamingTier: parsed.streamingTier ?? null,
    confidence: parsed.confidence ?? 0,
    rawText: opts.rawText,
    imageHash: opts.imageHash,
    modelUsed: opts.modelUsed,
    attempts: opts.attempts,
    // Only the vision flow flags needsManualProvider — text-PDF flow never does
    ...(opts.fromVision && { needsManualProvider: !matched && !!parsed.provider }),
  };
}

async function extractFromPdf(imageBuf: Buffer, imageHash: string): Promise<OcrResult> {
  const empty = emptyResult(imageHash);
  const pdfCached = ocrCache.get(imageHash) as OcrResult | null;
  if (pdfCached) return { ...pdfCached, cached: true };

  const ex = await extractPdfText(imageBuf);
  const textPathOk = ex.ok && !ex.empty;

  if (!apiKey || apiKey === "gsk_test_dummy") {
    return { ...empty, rawText: "PDF_OCR_SKIPPED_NO_API_KEY", needsManual: true };
  }

  // ── v13 DEEL 2: text-path first, vision-render fallback ──
  if (textPathOk) {
    const { raw, err } = await tryTextModel(TEXT_MODEL, ex.text);
    if (!err) {
      const parsed = parseOcrJson(raw);
      if (parsed.confidence != null && parsed.confidence >= 0.6 && parsed.amountCents != null) {
        const result = buildSuccessResult({
          parsed,
          imageHash,
          modelUsed: TEXT_MODEL,
          attempts: 1,
          rawText: raw,
          fromVision: false,
        });
        ocrCache.set(imageHash, result);
        return result;
      }
    }
  }

  // Vision fallback: scan-PDFs (no text-layer) OR text-path produced a
  // low-confidence result. Render up to 5 pages to PNG and ship them
  // as a single multi-image Groq Vision call.
  try {
    const { renderPdfPages } = await import("@/lib/pdf_render");
    const rendered = await renderPdfPages(imageBuf);
    if (rendered.ok && rendered.pageDataUrls.length > 0) {
      const model = visionModelOverride ?? VISION_MODELS[0];
      const { raw, err } = await tryModel(model, rendered.pageDataUrls);
      if (!err) {
        const parsed = parseOcrJson(raw);
        if (parsed.confidence != null && parsed.confidence >= 0.5 && parsed.amountCents != null) {
          const result = buildSuccessResult({
            parsed,
            imageHash,
            modelUsed: `${model} (multi-page ${rendered.pageDataUrls.length})`,
            attempts: 1,
            rawText: raw,
            fromVision: true,
          });
          ocrCache.set(imageHash, result);
          return result;
        }
      }
    }
  } catch {
    /* canvas unavailable — keep existing fall-through behaviour */
  }

  // Final fallback: surface what we got.
  if (!textPathOk) {
    return {
      ...empty,
      rawText: ex.error ? `PDF_EXTRACT_FAIL: ${ex.error}` : "PDF_SCAN_NO_TEXT",
      needsManual: true,
    };
  }
  return {
    ...empty,
    rawText: "PDF_PARSE_LOW_CONFIDENCE",
    needsManual: true,
    attempts: 1,
    modelUsed: TEXT_MODEL,
  };
}

async function extractFromImage(
  imageBuf: Buffer,
  mimeType: string,
  imageHash: string,
): Promise<OcrResult> {
  const empty = emptyResult(imageHash);
  const cached = ocrCache.get(imageHash) as OcrResult | null;
  if (cached) return { ...cached, cached: true };

  if (!apiKey || apiKey === "gsk_test_dummy") {
    return { ...empty, rawText: "OCR_SKIPPED_NO_API_KEY", needsManual: true };
  }

  const dataUrl = `data:${mimeType};base64,${imageBuf.toString("base64")}`;
  const models = visionModelOverride ? [visionModelOverride] : VISION_MODELS;
  let lastErr: Error | undefined;
  let attempts = 0;

  for (const model of models) {
    attempts += 1;
    const { raw, err } = await tryModelWithRetry(model, dataUrl);
    if (err) {
      lastErr = err;
      continue;
    }
    const parsed = parseOcrJson(raw);
    if (parsed.confidence != null && parsed.confidence >= 0.6 && parsed.amountCents != null) {
      const result = buildSuccessResult({
        parsed,
        imageHash,
        modelUsed: model,
        attempts,
        rawText: raw,
        fromVision: true,
      });
      ocrCache.set(imageHash, result);
      return result;
    }
    // Low confidence — try next model.
    lastErr = undefined;
  }

  return {
    ...empty,
    attempts,
    rawText: lastErr ? `OCR_ERROR_ALL_MODELS: ${lastErr.message}` : "OCR_LOW_CONFIDENCE_ALL_MODELS",
    needsManual: true,
  };
}

export async function extractBill(imageBuf: Buffer, mimeType: string): Promise<OcrResult> {
  const imageHash = hashImage(imageBuf);
  // E2E mock-mode: bypass Groq Vision (set GROQ_VISION_MOCK=1).
  if (process.env.GROQ_VISION_MOCK === "1") return mockBillResponse(imageHash);
  if (mimeType.toLowerCase() === "application/pdf") return extractFromPdf(imageBuf, imageHash);
  return extractFromImage(imageBuf, mimeType, imageHash);
}

/**
 * Map the internal PDF status marker to a user-facing message (NL).
 * Returns null when the input isn't a PDF marker (regular image-OCR).
 */
export function pdfFallbackMessage(rawText: string): string | null {
  if (!rawText) return null;
  if (rawText.startsWith("PDF_SCAN_NO_TEXT")) {
    return "Deze PDF lijkt een ingescande afbeelding — onze tekst-OCR werkt op tekst-gebaseerde PDFs. Upload tijdelijk een foto van de factuur.";
  }
  if (rawText.startsWith("PDF_EXTRACT_FAIL")) {
    return "We konden deze PDF niet uitlezen. Probeer 'm opnieuw te downloaden bij je provider of upload een foto.";
  }
  if (rawText.startsWith("PDF_LLM_ERR")) {
    return "De automatische analyse gaf een fout. Probeer over een paar minuten opnieuw — meestal ligt het aan de AI-service.";
  }
  if (rawText.startsWith("PDF_PARSE_LOW_CONFIDENCE")) {
    return "We lazen de PDF maar konden het bedrag of provider niet zeker bepalen. Vul de gegevens handmatig in.";
  }
  if (rawText.startsWith("PDF_OCR_SKIPPED_NO_API_KEY")) {
    return "AI-extractie is op deze omgeving uitgeschakeld. Vul de gegevens handmatig in.";
  }
  return null;
}

export function validateUploadedFile(opts: {
  size: number;
  type: string;
}): { ok: true } | { ok: false; error: string } {
  const MAX = 10 * 1024 * 1024;
  if (opts.size > MAX) return { ok: false, error: "Bestand groter dan 10 MB" };
  if (opts.size <= 0) return { ok: false, error: "Leeg bestand" };
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
  ];
  if (!allowed.includes(opts.type.toLowerCase())) {
    return { ok: false, error: "Alleen JPG/PNG/WebP/HEIC/PDF toegestaan" };
  }
  return { ok: true };
}
