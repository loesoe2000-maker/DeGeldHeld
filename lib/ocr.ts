/**
 * Bill OCR via Groq Vision met model cascade + retry.
 *
 *   Eerste poging:  llama-3.2-90b-vision-preview
 *   Fallback:       llama-3.2-11b-vision-preview
 *   Bij beide fail / lage confidence: needsManual = true
 *
 * PDF wordt niet door Groq Vision ondersteund — direct needsManual.
 */

import Groq from "groq-sdk";
import crypto from "node:crypto";
import { findProvider, type Category } from "@/lib/providers";

export type OcrResult = {
  ok: boolean;
  provider: string | null;
  category: Category | null;
  amountCents: number | null;
  plan: string | null;
  period: string | null;
  confidence: number; // 0..1
  rawText: string;
  imageHash: string;
  modelUsed?: string;
  attempts?: number;
  cached?: boolean;
};

const SYSTEM_PROMPT = `Je bent een OCR-engine voor Nederlandse facturen.
Extracteer alleen: provider naam, totaal maand-bedrag in euro, pakket-naam, periode.
Antwoord ALLEEN in JSON met velden: provider, amount_eur (number), plan, period, confidence (0-1).
Als iets niet leesbaar is, gebruik null. Geen uitleg, geen markdown.`;

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

export function parseOcrJson(raw: string): Partial<OcrResult> {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const provider = typeof obj.provider === "string" ? obj.provider : null;
    const amountEur = typeof obj.amount_eur === "number" ? obj.amount_eur : null;
    const plan = typeof obj.plan === "string" ? obj.plan : null;
    const period = typeof obj.period === "string" ? obj.period : null;
    const confidence = typeof obj.confidence === "number" ? obj.confidence : 0;
    return {
      provider,
      amountCents: amountEur != null ? Math.round(amountEur * 100) : null,
      plan,
      period,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  } catch {
    return { confidence: 0 };
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
      max_tokens: 400,
      temperature: 0.1,
    });
    return { raw: resp.choices[0]?.message?.content ?? "" };
  } catch (e) {
    return { raw: "", err: e as Error };
  }
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
    confidence: 0,
    rawText: "",
    imageHash,
    attempts: 0,
  };

  // PDF: Groq Vision accepts only images — skip directly to manual entry.
  if (mimeType.toLowerCase() === "application/pdf") {
    return { ...empty, rawText: "PDF_SKIPPED_VISION_UNSUPPORTED" };
  }

  if (!apiKey || apiKey === "gsk_test_dummy") {
    return { ...empty, rawText: "OCR_SKIPPED_NO_API_KEY" };
  }

  const dataUrl = `data:${mimeType};base64,${imageBuf.toString("base64")}`;
  const models = visionModelOverride ? [visionModelOverride] : VISION_MODELS;
  let lastErr: Error | undefined;
  let attempts = 0;

  for (const model of models) {
    attempts += 1;
    const { raw, err } = await tryModel(model, dataUrl);
    if (err) {
      lastErr = err;
      continue;
    }
    const parsed = parseOcrJson(raw);
    if (parsed.confidence != null && parsed.confidence >= 0.6 && parsed.amountCents != null) {
      const matched = parsed.provider ? findProvider(parsed.provider) : null;
      return {
        ok: true,
        provider: matched?.canonical ?? parsed.provider ?? null,
        category: matched?.category ?? null,
        amountCents: parsed.amountCents,
        plan: parsed.plan ?? null,
        period: parsed.period ?? null,
        confidence: parsed.confidence,
        rawText: raw,
        imageHash,
        modelUsed: model,
        attempts,
      };
    }
    // Low confidence on this model — try next.
    lastErr = undefined;
  }

  return {
    ...empty,
    attempts,
    rawText: lastErr ? `OCR_ERROR_ALL_MODELS: ${lastErr.message}` : "OCR_LOW_CONFIDENCE_ALL_MODELS",
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
