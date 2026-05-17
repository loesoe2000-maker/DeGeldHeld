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
{"provider":"KPN","monthly_subscription_eur":24.66,"total_eur":29.65,"one_time_items":["Online aankopen 4,99"],"plan":"Compleet","period":"mei 2026","customer_number":"12345678","language":"nl","confidence":0.92}

Voorbeeld JSON output (Vodafone pure abonnement):
{"provider":"Vodafone","monthly_subscription_eur":29.95,"total_eur":29.95,"one_time_items":[],"plan":"Red Unlimited","period":"mei 2026","customer_number":"87654321","language":"nl","confidence":0.94}`;

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
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  } catch {
    return { confidence: 0, language: "unknown", country: null, oneTimeItems: [] };
  }
}

async function tryModel(
  model: string,
  dataUrl: string,
): Promise<{ raw: string; err?: Error }> {
  try {
    const resp = await client().chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SYSTEM_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
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

export async function extractBill(imageBuf: Buffer, mimeType: string): Promise<OcrResult> {
  const imageHash = hashImage(imageBuf);

  // E2E mock-mode: bypass Groq Vision (set GROQ_VISION_MOCK=1).
  if (process.env.GROQ_VISION_MOCK === "1") {
    return mockBillResponse(imageHash);
  }

  const empty: OcrResult = {
    ok: false,
    provider: null,
    category: null,
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

  // PDF: extract text content via pdfjs (legacy, pure-node), then feed
  // raw text into Groq text LLM. Faster + cheaper than vision; works for
  // ~95% of text-based bill PDFs. Scan-PDFs (image-in-pdf) come back empty
  // and fall through to needsManual.
  if (mimeType.toLowerCase() === "application/pdf") {
    // Cache check on the PDF buffer hash directly.
    const pdfCached = ocrCache.get(imageHash) as OcrResult | null;
    if (pdfCached) return { ...pdfCached, cached: true };

    const ex = await extractPdfText(imageBuf);
    if (!ex.ok || ex.empty) {
      return {
        ...empty,
        rawText: ex.error ? `PDF_EXTRACT_FAIL: ${ex.error}` : "PDF_SCAN_NO_TEXT",
        needsManual: true,
      };
    }
    if (!apiKey || apiKey === "gsk_test_dummy") {
      return { ...empty, rawText: "PDF_OCR_SKIPPED_NO_API_KEY", needsManual: true };
    }
    const { raw, err } = await tryTextModel(TEXT_MODEL, ex.text);
    if (err) {
      return { ...empty, rawText: `PDF_LLM_ERR: ${err.message}`, needsManual: true };
    }
    const parsed = parseOcrJson(raw);
    if (parsed.confidence != null && parsed.confidence >= 0.6 && parsed.amountCents != null) {
      const matched = parsed.provider ? findProvider(parsed.provider) : null;
      const country: Country | null =
        parsed.country ?? (matched ? providerCountry(matched.canonical) : null);
      const result: OcrResult = {
        ok: true,
        provider: matched?.canonical ?? parsed.provider ?? null,
        category: matched?.category ?? null,
        monthlyAmountCents: parsed.monthlyAmountCents ?? parsed.amountCents,
        totalAmountCents: parsed.totalAmountCents ?? parsed.amountCents,
        amountCents: parsed.monthlyAmountCents ?? parsed.totalAmountCents ?? parsed.amountCents,
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
        confidence: parsed.confidence,
        rawText: raw,
        imageHash,
        modelUsed: TEXT_MODEL,
        attempts: 1,
      };
      ocrCache.set(imageHash, result);
      return result;
    }
    return {
      ...empty,
      rawText: raw || "PDF_PARSE_LOW_CONFIDENCE",
      needsManual: true,
      attempts: 1,
      modelUsed: TEXT_MODEL,
    };
  }

  // Cache: skip Groq call if same image already extracted within 30d.
  const cached = ocrCache.get(imageHash) as OcrResult | null;
  if (cached) {
    return { ...cached, cached: true };
  }

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
      const matched = parsed.provider ? findProvider(parsed.provider) : null;
      // Country derivation: prefer OCR-detected, then provider's home country,
      // then null. Means a Vodafone DE invoice scanned in NL still tags as DE.
      const country: Country | null =
        parsed.country ?? (matched ? providerCountry(matched.canonical) : null);
      const result: OcrResult = {
        ok: true,
        provider: matched?.canonical ?? parsed.provider ?? null,
        category: matched?.category ?? null,
        monthlyAmountCents: parsed.monthlyAmountCents ?? parsed.amountCents,
        totalAmountCents: parsed.totalAmountCents ?? parsed.amountCents,
        // amountCents = preferred maand-bedrag voor markt-vergelijking
        amountCents: parsed.monthlyAmountCents ?? parsed.totalAmountCents ?? parsed.amountCents,
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
        confidence: parsed.confidence,
        rawText: raw,
        imageHash,
        modelUsed: model,
        attempts,
        // Provider was extracted but doesn't match registry → ask user to pick
        needsManualProvider: !matched && !!parsed.provider,
      };
      ocrCache.set(imageHash, result);
      return result;
    }
    // Low confidence on this model — try next.
    lastErr = undefined;
  }

  return {
    ...empty,
    attempts,
    rawText: lastErr ? `OCR_ERROR_ALL_MODELS: ${lastErr.message}` : "OCR_LOW_CONFIDENCE_ALL_MODELS",
    needsManual: true,
  };
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
