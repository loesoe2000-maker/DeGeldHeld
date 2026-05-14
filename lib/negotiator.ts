/**
 * Onderhandel-email generator via Groq llama-3.1.
 * Returns subject + body + reasoning + expectedSavings + confidence.
 */

import Groq from "groq-sdk";
import type { Alternative } from "@/lib/comparison";

export type NegotiationStrategy = "RETENTIE_DREIG" | "SWITCH_CLAIM" | "LOYALTY";

export type NegotiatorInput = {
  customerName: string;
  provider: string;
  category: string;
  currentPlan: string | null;
  currentMonthlyCents: number;
  alternatives: Alternative[];
  strategy?: NegotiationStrategy;
};

export type NegotiatorOutput = {
  subject: string;
  body: string;
  strategy: NegotiationStrategy;
  reasoning: string;
  expectedSavingsCents: number;
  confidence: number;
};

const apiKey = process.env.GROQ_API_KEY ?? "";
const textModel = process.env.GROQ_TEXT_MODEL ?? "llama-3.1-70b-versatile";

let _client: Groq | null = null;
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey });
  return _client;
}

export function chooseStrategy(input: NegotiatorInput): NegotiationStrategy {
  if (input.strategy) return input.strategy;
  const best = input.alternatives[0];
  if (!best) return "LOYALTY";
  // High savings + concrete competitor → switch threat
  if (best.percentSaved >= 0.2) return "SWITCH_CLAIM";
  // Modest savings → retention with leverage
  if (best.percentSaved >= 0.08) return "RETENTIE_DREIG";
  return "LOYALTY";
}

export function buildPrompt(input: NegotiatorInput): { system: string; user: string } {
  const strategy = chooseStrategy(input);
  const best = input.alternatives[0];

  const system = `Je bent een Nederlandse onderhandelings-assistent. Je schrijft een korte, beleefde
maar besliste e-mail aan een retentie-/klantenservice afdeling om een lager
maandbedrag te vragen. Schrijf in het Nederlands, in 'u'-vorm, max 180 woorden.
Gebruik concrete cijfers waar je die hebt. Sluit af met een specifieke vraag
("kunt u mij een voorstel doen voor X per maand?"). Geen smileys, geen overdrijving.

Antwoord in JSON met velden:
  subject (string),
  body (string, met regelovergangen \\n),
  reasoning (string, korte uitleg waarom deze hoek werkt),
  expected_savings_eur_yearly (number),
  confidence (0-1).`;

  const altSummary = input.alternatives
    .slice(0, 3)
    .map(
      (a) =>
        `${a.plan.provider} ${a.plan.name} = €${(a.plan.priceCents / 100).toFixed(2)}/mnd`,
    )
    .join("; ");

  const user = `Klant: ${input.customerName}
Provider: ${input.provider}
Categorie: ${input.category}
Huidig pakket: ${input.currentPlan ?? "onbekend"}
Huidig bedrag: €${(input.currentMonthlyCents / 100).toFixed(2)}/maand
Strategie: ${strategy}
Goedkopere alternatieven: ${altSummary || "geen"}
Beste alternatief jaarlijkse besparing: €${best ? (best.yearlySavingsCents / 100).toFixed(0) : "0"}

Schrijf de e-mail volgens de gekozen strategie:
- RETENTIE_DREIG: vraag retentie-team om matching met goedkoper aanbod, noem alternatief
- SWITCH_CLAIM: maak duidelijk dat je serieus overweegt over te stappen, vraag concreet voorstel
- LOYALTY: noem aantal jaren klant, vraag vriendelijk om loyaliteits-korting`;

  return { system, user };
}

export function parseNegotiatorJson(raw: string): Partial<NegotiatorOutput> {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const eurYearly = typeof obj.expected_savings_eur_yearly === "number" ? obj.expected_savings_eur_yearly : 0;
    return {
      subject: typeof obj.subject === "string" ? obj.subject : "",
      body: typeof obj.body === "string" ? obj.body : "",
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
      expectedSavingsCents: Math.round(eurYearly * 100),
      confidence: Math.max(0, Math.min(1, typeof obj.confidence === "number" ? obj.confidence : 0)),
    };
  } catch {
    return { confidence: 0 };
  }
}

/**
 * Validate LLM output is bruikbaar voor user. Hard gates:
 *  - subject >= 5 chars (anders meaningless)
 *  - body >= 100 chars (anders te kort voor onderhandel)
 *  - body bevat naam van de provider (anchored relevance)
 */
export function isUsableEmail(opts: {
  subject: string;
  body: string;
  provider: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!opts.subject || opts.subject.trim().length < 5) {
    return { ok: false, reason: "subject too short" };
  }
  if (!opts.body || opts.body.trim().length < 100) {
    return { ok: false, reason: "body too short (<100 chars)" };
  }
  if (!opts.body.toLowerCase().includes(opts.provider.toLowerCase())) {
    return { ok: false, reason: "body missing provider name" };
  }
  return { ok: true };
}

export async function generateEmail(input: NegotiatorInput): Promise<NegotiatorOutput> {
  const strategy = chooseStrategy(input);
  const fallback: NegotiatorOutput = {
    subject: `Verzoek: nieuw voorstel ${input.provider}`,
    body: `Geachte heer/mevrouw,\n\nIk ben sinds geruime tijd klant bij ${input.provider}. Mijn huidige maandbedrag is €${(input.currentMonthlyCents / 100).toFixed(2)}. Ik zie bij andere aanbieders gunstigere voorwaarden en hoor graag uw voorstel.\n\nMet vriendelijke groet,\n${input.customerName}`,
    strategy,
    reasoning: "Fallback template — geen LLM beschikbaar.",
    expectedSavingsCents: input.alternatives[0]?.yearlySavingsCents ?? 0,
    confidence: 0.3,
  };

  if (!apiKey || apiKey === "gsk_test_dummy") return fallback;

  const { system, user } = buildPrompt(input);
  let raw = "";
  try {
    const resp = await client().chat.completions.create({
      model: textModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 600,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });
    raw = resp.choices[0]?.message?.content ?? "";
  } catch {
    return fallback;
  }
  const parsed = parseNegotiatorJson(raw);
  if (!parsed.subject || !parsed.body) return fallback;

  const validation = isUsableEmail({
    subject: parsed.subject,
    body: parsed.body,
    provider: input.provider,
  });
  if (!validation.ok) {
    return { ...fallback, reasoning: `LLM output rejected: ${validation.reason}` };
  }

  return {
    subject: parsed.subject,
    body: parsed.body,
    strategy,
    reasoning: parsed.reasoning ?? "",
    expectedSavingsCents: parsed.expectedSavingsCents ?? input.alternatives[0]?.yearlySavingsCents ?? 0,
    confidence: parsed.confidence ?? 0.5,
  };
}
