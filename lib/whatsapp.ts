/**
 * lib/whatsapp.ts — Twilio / 360dialog webhook helpers.
 *
 * Twilio signs WhatsApp webhooks with HMAC-SHA1 of full URL + sorted
 * POST params; 360dialog uses a simpler shared-secret header. We
 * implement Twilio (industry standard) and fall back to a shared-secret
 * compare for 360dialog when WHATSAPP_PROVIDER=360.
 *
 * AI counter generation reuses the Groq text model (llama-3.3-70b-versatile).
 */

import crypto from "node:crypto";
import Groq from "groq-sdk";

const TEXT_MODEL = "llama-3.3-70b-versatile";

export function isWhatsAppEnabled(): boolean {
  // Honors legacy WHATSAPP_ENABLED + new FEATURE_WHATSAPP_ENABLED
  if (process.env.WHATSAPP_ENABLED === "true") return true;
  if (process.env.FEATURE_WHATSAPP_ENABLED === "true") return true;
  return false;
}

export function verifyTwilioSignature(opts: {
  url: string;
  params: Record<string, string>;
  signature: string | null;
  authToken: string;
}): boolean {
  if (!opts.signature || !opts.authToken) return false;
  // Twilio: HMAC-SHA1(url + concat(key,val) sorted by key, authToken), base64
  const sortedKeys = Object.keys(opts.params).sort();
  const concat = opts.url + sortedKeys.map((k) => k + opts.params[k]).join("");
  const expected = crypto.createHmac("sha1", opts.authToken).update(concat).digest("base64");
  try {
    const a = Buffer.from(opts.signature, "base64");
    const b = Buffer.from(expected, "base64");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verify360dialogSecret(headerVal: string | null): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret || !headerVal) return false;
  const a = Buffer.from(headerVal, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type IncomingMessage = {
  fromNumber: string;
  toNumber: string;
  body: string;
  mediaUrl?: string;
};

/**
 * Normalize Twilio form-encoded payload to a structured message.
 * Twilio params include: From, To, Body, NumMedia, MediaUrl0…N
 */
export function parseTwilioMessage(params: Record<string, string>): IncomingMessage | null {
  const from = params.From ?? params.WaId ?? "";
  const to = params.To ?? "";
  const body = params.Body ?? "";
  if (!from || !to) return null;
  return {
    fromNumber: from.replace(/^whatsapp:/, ""),
    toNumber: to.replace(/^whatsapp:/, ""),
    body,
    mediaUrl: params.MediaUrl0 || undefined,
  };
}

let _groq: Groq | null = null;
function client(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
  return _groq;
}

/**
 * Analyse the provider response and generate a counter-proposal in NL.
 * Returns subject + body suitable to mirror on WhatsApp.
 * Caller MUST present this as a draft to the user — never auto-send.
 */
export async function analyseProviderResponse(opts: {
  providerName: string;
  providerMessage: string;
  currentMonthlyEur: number;
  alternativeName?: string;
  alternativeMonthlyEur?: number;
}): Promise<{ analysis: string; counter: string; tone: "FORMEEL" | "INFORMEEL" }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "gsk_test_dummy") {
    // Deterministic fallback (no LLM call) — keeps tests + dev flows working
    return {
      analysis: `Provider ${opts.providerName} bood iets aan; analyse niet beschikbaar (geen LLM-key).`,
      counter:
        `Bedankt voor je bericht. Ik blijf graag klant bij ${opts.providerName}, maar het aangeboden tarief ` +
        `is nog niet marktconform. ${opts.alternativeName ? `${opts.alternativeName} biedt ${opts.alternativeMonthlyEur?.toFixed(2)}/mnd. ` : ""}` +
        `Kun je dit nog matchen? Anders zal ik helaas overstappen.`,
      tone: "FORMEEL",
    };
  }
  const prompt = `Je bent een Nederlandse onderhandelaar. Een provider antwoordde via WhatsApp; lees het bericht en stel een korte tegenvraag (counter) op in dezelfde taal.

Provider: ${opts.providerName}
Huidig maandbedrag: €${opts.currentMonthlyEur.toFixed(2)}
${opts.alternativeName ? `Goedkoper alternatief: ${opts.alternativeName} voor €${opts.alternativeMonthlyEur?.toFixed(2)}/mnd` : ""}

Provider's bericht:
"""${opts.providerMessage}"""

Geef in JSON:
- analysis: 1 zin samenvatting (NL)
- counter: max 200 woorden tegenvoorstel (NL, beleefd, concreet)
- tone: "FORMEEL" of "INFORMEEL"`;

  const resp = await client().chat.completions.create({
    model: TEXT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 500,
    temperature: 0.3,
  });
  const raw = resp.choices[0]?.message?.content ?? "{}";
  try {
    const obj = JSON.parse(raw) as { analysis?: string; counter?: string; tone?: string };
    const tone: "FORMEEL" | "INFORMEEL" = obj.tone === "INFORMEEL" ? "INFORMEEL" : "FORMEEL";
    return {
      analysis: obj.analysis ?? "",
      counter: obj.counter ?? "",
      tone,
    };
  } catch {
    return { analysis: "", counter: "", tone: "FORMEEL" };
  }
}
