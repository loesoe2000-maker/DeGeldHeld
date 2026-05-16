/**
 * Dynamic alternatives via Groq — used for non-NL countries where we don't
 * maintain a hard-coded price table. Cache 7 days per (provider, category,
 * plan, country) tuple.
 *
 * Returns up to 3 cheaper alternatives with rough price ranges. If Groq is
 * down or the cache key is poisoned with garbage, we return an empty array
 * and the caller falls back to category-level guidance.
 */

import Groq from "groq-sdk";
import type { Category, Country } from "@/lib/providers";

function apiKey(): string {
  return process.env.GROQ_API_KEY ?? "";
}
function textModel(): string {
  return process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile";
}

let _client: Groq | null = null;
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey: apiKey() });
  return _client;
}

/** Test seam — override the Groq completion call. */
export type GroqChatCall = (args: {
  model: string;
  system: string;
  user: string;
}) => Promise<string>;

let _chatOverride: GroqChatCall | null = null;
export function __setGroqChat(fn: GroqChatCall | null): void {
  _chatOverride = fn;
}

async function chat(system: string, user: string): Promise<string> {
  if (_chatOverride) return _chatOverride({ model: textModel(), system, user });
  const resp = await client().chat.completions.create({
    model: textModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 500,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });
  return resp.choices[0]?.message?.content ?? "";
}

export type DynamicAlternative = {
  provider: string;
  plan: string;
  /** Inclusive low end of monthly price in EUR (or local currency for non-EUR markets). */
  priceLowEur: number;
  priceHighEur: number;
  rationale: string;
};

type Entry = { value: DynamicAlternative[]; expiresAt: number };
const cache = new Map<string, Entry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function key(provider: string, category: Category, plan: string | null, country: Country): string {
  return `${country}|${category}|${provider.toLowerCase()}|${(plan ?? "default").toLowerCase()}`;
}

function isValid(obj: unknown): obj is DynamicAlternative {
  if (!obj || typeof obj !== "object") return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.provider === "string" &&
    typeof r.plan === "string" &&
    typeof r.priceLowEur === "number" &&
    typeof r.priceHighEur === "number" &&
    typeof r.rationale === "string" &&
    r.priceLowEur >= 0 &&
    r.priceHighEur >= r.priceLowEur &&
    r.priceHighEur < 10000
  );
}

function parseGroqJson(raw: string): DynamicAlternative[] {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const arr = obj.alternatives ?? obj.data ?? obj;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((a) => {
        const r = a as Record<string, unknown>;
        return {
          provider: String(r.provider ?? ""),
          plan: String(r.plan ?? r.name ?? ""),
          priceLowEur: Number(r.price_low_eur ?? r.priceLowEur ?? r.price_eur ?? 0),
          priceHighEur: Number(r.price_high_eur ?? r.priceHighEur ?? r.price_eur ?? 0),
          rationale: String(r.rationale ?? r.reason ?? ""),
        } as DynamicAlternative;
      })
      .filter(isValid)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function fetchDynamicAlternatives(opts: {
  provider: string;
  category: Category;
  plan: string | null;
  country: Country;
  currentMonthlyEur: number;
}): Promise<DynamicAlternative[]> {
  const k = key(opts.provider, opts.category, opts.plan, opts.country);
  const cached = cache.get(k);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const key2 = apiKey();
  if (!_chatOverride && (!key2 || key2 === "gsk_test_dummy")) {
    return [];
  }

  const system = `Je bent een markt-research assistent voor consumenten in
${opts.country}. Antwoord met 3 goedkopere realistische alternatieven voor
de gegeven provider/categorie/pakket combinatie. Output ALLEEN JSON met
shape: { "alternatives": [{ "provider": str, "plan": str,
"price_low_eur": num, "price_high_eur": num, "rationale": str (1 zin) }] }.
Gebruik gangbare bedragen in lokale prijsklasse, omgerekend naar EUR.
Wees concreet (echte providers in dat land). Verzin geen fictieve namen.`;

  const user = `Provider: ${opts.provider}
Categorie: ${opts.category}
Pakket: ${opts.plan ?? "onbekend"}
Land: ${opts.country}
Huidig bedrag: €${opts.currentMonthlyEur.toFixed(2)} per maand
Vraag: noem 3 goedkopere alternatieven die in ${opts.country} verkrijgbaar zijn.`;

  let raw = "";
  try {
    raw = await chat(system, user);
  } catch {
    return [];
  }

  const alts = parseGroqJson(raw);
  cache.set(k, { value: alts, expiresAt: Date.now() + TTL_MS });
  return alts;
}

export function clearDynamicAlternativesCache(): void {
  cache.clear();
}

export function dynamicAlternativesCacheSize(): number {
  return cache.size;
}
