/**
 * Bill OCR via Groq Vision (llama-3.2-90b-vision).
 * Falls back to manual entry if extraction fails or confidence < 0.6.
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
  cached?: boolean;
};

const SYSTEM_PROMPT = `Je bent een OCR-engine voor Nederlandse facturen.
Extracteer alleen: provider naam, totaal maand-bedrag in euro, pakket-naam, periode.
Antwoord ALLEEN in JSON met velden: provider, amount_eur (number), plan, period, confidence (0-1).
Als iets niet leesbaar is, gebruik null. Geen uitleg, geen markdown.`;

const apiKey = process.env.GROQ_API_KEY ?? "";
const visionModel = process.env.GROQ_VISION_MODEL ?? "llama-3.2-90b-vision-preview";

let _client: Groq | null = null;
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey });
  return _client;
}

export function hashImage(buf: Uint8Array | Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function extractEurFromText(s: string): number | null {
  // Matches "€ 42,50", "42.50", "EUR 42,50"
  const m = /(?:€|EUR)?\s*([0-9]{1,4}(?:[.,][0-9]{2}))/i.exec(s);
  if (!m) return null;
  const num = Number(m[1].replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

export function parseOcrJson(raw: string): Partial<OcrResult> {
  try {
    // strip markdown fence if any
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
  };

  if (!apiKey || apiKey === "gsk_test_dummy") {
    return { ...empty, ok: false, rawText: "OCR_SKIPPED_NO_API_KEY" };
  }

  const dataUrl = `data:${mimeType};base64,${imageBuf.toString("base64")}`;

  let raw = "";
  try {
    const resp = await client().chat.completions.create({
      model: visionModel,
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
    raw = resp.choices[0]?.message?.content ?? "";
  } catch (e) {
    return { ...empty, rawText: `OCR_ERROR: ${(e as Error).message}` };
  }

  const parsed = parseOcrJson(raw);
  const matched = parsed.provider ? findProvider(parsed.provider) : null;
  const ok = parsed.confidence != null && parsed.confidence >= 0.6 && parsed.amountCents != null;
  return {
    ok,
    provider: matched?.canonical ?? parsed.provider ?? null,
    category: matched?.category ?? null,
    amountCents: parsed.amountCents ?? null,
    plan: parsed.plan ?? null,
    period: parsed.period ?? null,
    confidence: parsed.confidence ?? 0,
    rawText: raw,
    imageHash,
  };
}

export function validateUploadedFile(opts: {
  size: number;
  type: string;
}): { ok: true } | { ok: false; error: string } {
  const MAX = 10 * 1024 * 1024;
  if (opts.size > MAX) return { ok: false, error: "Bestand groter dan 10 MB" };
  if (opts.size <= 0) return { ok: false, error: "Leeg bestand" };
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(opts.type.toLowerCase())) {
    return { ok: false, error: "Alleen JPG/PNG/WebP/HEIC toegestaan" };
  }
  return { ok: true };
}
