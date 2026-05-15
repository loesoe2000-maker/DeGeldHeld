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
import { findProvider, type Category } from "@/lib/providers";
import { ocrCache } from "@/lib/llm_cache";

export type OcrResult = {
  ok: boolean;
  provider: string | null;
  category: Category | null;
  amountCents: number | null;
  plan: string | null;
  period: string | null;
  customerNumber: string | null;
  language: "nl" | "en" | "de" | "unknown";
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
const SYSTEM_PROMPT = `Je bent een multilingual OCR-engine voor facturen (NL/EN/DE).
Lees de factuur en extracteer:
  - provider: bedrijfs-/leveranciersnaam (zoals afgedrukt, geen interpretatie)
  - amount_eur: totaal maand-bedrag in euro (number, geen valuta-symbool)
  - plan: pakket-/tarief-/abonnementsnaam indien zichtbaar
  - period: factuur-periode (bv "mei 2026" of "2026-05")
  - customer_number: klantnummer / klant-id / Kundennummer / customer ID
  - language: "nl" | "en" | "de" (auto-detect)
  - confidence: 0-1 (hoe zeker ben je over provider+amount samen)

Belangrijke regels:
  - Verzin GEEN waarden — null bij twijfel
  - Provider naam exact zoals afgedrukt (niet vertalen, niet normaliseren)
  - Bij PDF/scan met meerdere bedragen: kies het maand-totaal (niet jaar/eenmalig)
  - Antwoord ALLEEN in JSON, geen markdown, geen toelichting

Voorbeeld JSON output:
{"provider":"Vodafone","amount_eur":29.95,"plan":"Red Unlimited","period":"mei 2026","customer_number":"12345678","language":"nl","confidence":0.92}`;

export const VISION_MODELS = [
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
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

export function parseOcrJson(raw: string): Partial<OcrResult> {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const provider = typeof obj.provider === "string" ? obj.provider : null;
    const amountEur = typeof obj.amount_eur === "number" ? obj.amount_eur : null;
    const plan = typeof obj.plan === "string" ? obj.plan : null;
    const period = typeof obj.period === "string" ? obj.period : null;
    const customerNumber = typeof obj.customer_number === "string" ? obj.customer_number : null;
    const confidence = typeof obj.confidence === "number" ? obj.confidence : 0;
    return {
      provider,
      amountCents: amountEur != null ? Math.round(amountEur * 100) : null,
      plan,
      period,
      customerNumber,
      language: detectLanguage(obj.language),
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  } catch {
    return { confidence: 0, language: "unknown" };
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

export async function extractBill(imageBuf: Buffer, mimeType: string): Promise<OcrResult> {
  const imageHash = hashImage(imageBuf);
  const empty: OcrResult = {
    ok: false,
    provider: null,
    category: null,
    amountCents: null,
    plan: null,
    period: null,
    customerNumber: null,
    language: "unknown",
    confidence: 0,
    rawText: "",
    imageHash,
    attempts: 0,
  };

  // PDF: Groq Vision accepts only images — skip directly to manual entry.
  if (mimeType.toLowerCase() === "application/pdf") {
    return { ...empty, rawText: "PDF_SKIPPED_VISION_UNSUPPORTED", needsManual: true };
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
      const result: OcrResult = {
        ok: true,
        provider: matched?.canonical ?? parsed.provider ?? null,
        category: matched?.category ?? null,
        amountCents: parsed.amountCents,
        plan: parsed.plan ?? null,
        period: parsed.period ?? null,
        customerNumber: parsed.customerNumber ?? null,
        language: parsed.language ?? "unknown",
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
