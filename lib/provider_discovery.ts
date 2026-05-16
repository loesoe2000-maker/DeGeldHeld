/**
 * Discover retention contact info for an unknown provider.
 *
 * Strategy:
 *  1. Fetch a generic search snippet (DuckDuckGo HTML), pull text content.
 *  2. Fetch the provider's likely contact page (heuristic guess).
 *  3. Ask Groq to extract email/phone/url/hours from concatenated text.
 *  4. Return a structured candidate. If nothing trustworthy is found, return
 *     ok:false instead of fabricating data — sprint regel: niets verzinnen.
 */

import Groq from "groq-sdk";

export type DiscoveredRetention = {
  email?: string;
  phone?: string;
  whatsapp?: string;
  url?: string;
  hours?: string;
};

export type DiscoveryResult =
  | { ok: true; retention: DiscoveredRetention; sources: string[] }
  | { ok: false; reason: string };

const apiKey = (): string => process.env.GROQ_API_KEY ?? "";
const textModel = (): string => process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile";

let _client: Groq | null = null;
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey: apiKey() });
  return _client;
}

/** Test seam — override the fetch + LLM extraction. */
export type DiscoveryDeps = {
  webFetch: (url: string) => Promise<string>;
  llmExtract: (text: string) => Promise<DiscoveredRetention | null>;
};

let _depsOverride: DiscoveryDeps | null = null;
export function __setDiscoveryDeps(d: DiscoveryDeps | null): void {
  _depsOverride = d;
}

async function defaultWebFetch(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { "user-agent": "DeGeldHeldDiscoveryBot/1.0 (+https://degeldheld.com)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return "";
  const text = await resp.text();
  // Strip HTML tags crudely — model is good with raw text + tags but limit size.
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
}

async function defaultLlmExtract(text: string): Promise<DiscoveredRetention | null> {
  const key = apiKey();
  if (!key || key === "gsk_test_dummy") return null;
  try {
    const resp = await client().chat.completions.create({
      model: textModel(),
      messages: [
        {
          role: "system",
          content: `Je bent een extract-engine. Uit de gegeven webpagina-tekst,
extracteer voor het retentie-team van het bedrijf:
  - email: klantenservice/retentie e-mail
  - phone: klantenservice telefoon (internationaal formaat indien aanwezig)
  - whatsapp: WhatsApp business nummer
  - url: contact-/opzegpagina URL
  - hours: openingstijden
Antwoord ALLEEN JSON. Velden ontbreken als ze niet duidelijk in de tekst staan.
NIET verzinnen — leeg JSON object als niets gevonden.`,
        },
        { role: "user", content: text.slice(0, 6000) },
      ],
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    return parseRetentionJson(raw);
  } catch {
    return null;
  }
}

export function parseRetentionJson(raw: string): DiscoveredRetention | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const out: DiscoveredRetention = {};
    if (typeof obj.email === "string" && /@/.test(obj.email)) out.email = obj.email;
    if (typeof obj.phone === "string" && obj.phone.length >= 6) out.phone = obj.phone;
    if (typeof obj.whatsapp === "string" && obj.whatsapp.length >= 6) {
      out.whatsapp = obj.whatsapp;
    }
    if (typeof obj.url === "string" && /^https?:\/\//.test(obj.url)) out.url = obj.url;
    if (typeof obj.hours === "string" && obj.hours.length > 0) out.hours = obj.hours;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export async function discoverProvider(opts: {
  name: string;
  country: string;
}): Promise<DiscoveryResult> {
  const name = opts.name.trim();
  if (!name) return { ok: false, reason: "empty-name" };

  const webFetch = _depsOverride?.webFetch ?? defaultWebFetch;
  const llmExtract = _depsOverride?.llmExtract ?? defaultLlmExtract;

  const queries = [
    `https://duckduckgo.com/html/?q=${encodeURIComponent(`${name} retention contact email ${opts.country}`)}`,
    `https://duckduckgo.com/html/?q=${encodeURIComponent(`${name} klantenservice contact ${opts.country}`)}`,
  ];

  const sources: string[] = [];
  const buffers: string[] = [];
  for (const q of queries) {
    try {
      const body = await webFetch(q);
      if (body.length > 200) {
        sources.push(q);
        buffers.push(body);
      }
    } catch {
      /* silently skip individual fetches */
    }
    if (buffers.join("").length > 4000) break;
  }

  if (buffers.length === 0) {
    return { ok: false, reason: "no-sources" };
  }

  const combined = buffers.join("\n\n").slice(0, 8000);
  const retention = await llmExtract(combined);
  if (!retention || Object.keys(retention).length === 0) {
    return { ok: false, reason: "no-extractable-contact" };
  }

  return { ok: true, retention, sources };
}
