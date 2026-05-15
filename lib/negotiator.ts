/**
 * Onderhandel-email generator via Groq llama-3.1.
 *
 * v3 upgrades:
 *  - 5 strategieën (was 3): RETENTIE_DREIG, SWITCH_CLAIM, LOYALTY,
 *    NIEUWE_KLANT_VERGELIJK, LANGETERMIJN_KORTING
 *  - Tonality: "FORMEEL" (u-vorm) of "CASUAL" (je-vorm)
 *  - Language: "nl" of "en"
 *  - Per provider custom hint (retentie-afdeling, klantnummer prompt etc)
 *  - WhatsApp share helper (build text + URL)
 */

import Groq from "groq-sdk";
import type { Alternative } from "@/lib/comparison";

export type NegotiationStrategy =
  | "RETENTIE_DREIG"
  | "SWITCH_CLAIM"
  | "LOYALTY"
  | "NIEUWE_KLANT_VERGELIJK"
  | "LANGETERMIJN_KORTING";

export type Tonality = "FORMEEL" | "CASUAL";
export type Language = "nl" | "en";

export type NegotiatorInput = {
  customerName: string;
  provider: string;
  category: string;
  currentPlan: string | null;
  currentMonthlyCents: number;
  alternatives: Alternative[];
  strategy?: NegotiationStrategy;
  tonality?: Tonality;
  language?: Language;
  customerYears?: number;
};

export type NegotiatorOutput = {
  subject: string;
  body: string;
  strategy: NegotiationStrategy;
  tonality: Tonality;
  language: Language;
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

export const ALL_STRATEGIES: NegotiationStrategy[] = [
  "RETENTIE_DREIG",
  "SWITCH_CLAIM",
  "LOYALTY",
  "NIEUWE_KLANT_VERGELIJK",
  "LANGETERMIJN_KORTING",
];

const STRATEGY_DESCRIPTIONS_NL: Record<NegotiationStrategy, string> = {
  RETENTIE_DREIG:
    "Vraag retentie-team om matching met goedkoper aanbod, noem concreet alternatief",
  SWITCH_CLAIM:
    "Maak duidelijk dat je serieus overweegt over te stappen, vraag concreet voorstel",
  LOYALTY:
    "Noem aantal jaren klant, vraag vriendelijk om loyaliteits-korting",
  NIEUWE_KLANT_VERGELIJK:
    "Wijs op het feit dat nieuwe klanten goedkoper aanbod krijgen, vraag dezelfde deal",
  LANGETERMIJN_KORTING:
    "Bied aan langer contract te tekenen (1-2 jaar) in ruil voor structurele korting",
};

const STRATEGY_DESCRIPTIONS_EN: Record<NegotiationStrategy, string> = {
  RETENTIE_DREIG:
    "Ask retention team to match a cheaper offer, name a concrete alternative",
  SWITCH_CLAIM:
    "Make clear you're seriously considering switching, ask for a concrete proposal",
  LOYALTY:
    "Mention years as a customer, politely request a loyalty discount",
  NIEUWE_KLANT_VERGELIJK:
    "Point out new customers get cheaper deals, ask for the same offer",
  LANGETERMIJN_KORTING:
    "Offer to sign a longer contract (1-2 years) in exchange for a structural discount",
};

export function chooseStrategy(input: NegotiatorInput): NegotiationStrategy {
  if (input.strategy) return input.strategy;
  const best = input.alternatives[0];
  if (!best) return "LOYALTY";
  // Backwards-compat thresholds (v2): SWITCH ≥20%, RETENTIE 8-19%, rest LOYALTY.
  // v3 adds two new tiers between them.
  if (best.percentSaved >= 0.2) return "SWITCH_CLAIM";
  if (best.percentSaved >= 0.08) return "RETENTIE_DREIG";
  // v3 nieuwe routes voor sub-8% savings:
  if ((input.customerYears ?? 0) >= 5) return "LANGETERMIJN_KORTING";
  if (best.percentSaved >= 0.03) return "NIEUWE_KLANT_VERGELIJK";
  return "LOYALTY";
}

/** Provider-specifieke aanwijzingen die de prompt explicit maken. */
function providerHint(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes("kpn")) return "KPN heeft een retentie-afdeling die actief tegenbiedingen doet — vraag direct naar 'klantbehoud'.";
  if (p.includes("vodafone")) return "Vodafone Red retentie matched vaak Tele2/Odido prijzen — verwijs concreet.";
  if (p.includes("ziggo")) return "Ziggo heeft 'Ziggo voor jou'-team voor klantbehoud, vraag specifiek korting op het abonnement.";
  if (p.includes("eneco")) return "Eneco hanteert vaste contracten — focus op vroegtijdige verlenging tegen scherper tarief.";
  if (p.includes("netflix") || p.includes("spotify")) return "Streaming providers bieden zelden korting — overweeg downgrade naar lagere tier of jaarbetaling.";
  return "";
}

export function buildPrompt(input: NegotiatorInput): { system: string; user: string } {
  const strategy = chooseStrategy(input);
  const tonality = input.tonality ?? "FORMEEL";
  const language = input.language ?? "nl";
  const best = input.alternatives[0];
  const hint = providerHint(input.provider);

  const langLabel = language === "nl" ? "Nederlandse" : "Engelse";
  const tonalityLabel =
    tonality === "FORMEEL"
      ? language === "nl"
        ? "u-vorm, beleefd-formeel"
        : "polite, formal"
      : language === "nl"
      ? "je-vorm, vriendelijk-direct"
      : "casual, direct but friendly";

  const system = `Je bent een ${langLabel} onderhandelings-assistent. Je schrijft een korte, beleefde
maar besliste e-mail aan een retentie-/klantenservice afdeling om een lager
maandbedrag te vragen.

Stijl: ${tonalityLabel}, max 180 woorden.
Taal: ${language === "nl" ? "Nederlands" : "English"}.
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

  const strategyDescriptions = language === "nl" ? STRATEGY_DESCRIPTIONS_NL : STRATEGY_DESCRIPTIONS_EN;
  const strategyDesc = strategyDescriptions[strategy];

  const user = `Klant: ${input.customerName}
Provider: ${input.provider}
Categorie: ${input.category}
Huidig pakket: ${input.currentPlan ?? "onbekend"}
Huidig bedrag: €${(input.currentMonthlyCents / 100).toFixed(2)}/maand
Klant sinds: ${input.customerYears ? `${input.customerYears} jaar` : "onbekend"}
Strategie: ${strategy} — ${strategyDesc}
Goedkopere alternatieven: ${altSummary || "geen"}
Beste alternatief jaarlijkse besparing: €${best ? (best.yearlySavingsCents / 100).toFixed(0) : "0"}
${hint ? `\nProvider-tip: ${hint}` : ""}

Schrijf de e-mail volgens de gekozen strategie. Wees concreet.`;

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
 *  - subject >= 5 chars
 *  - body >= 100 chars
 *  - body bevat naam van de provider
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

/**
 * Build a WhatsApp shareable URL.
 * Mobile apps open whatsapp://, desktop opens https://wa.me/.
 * We use https://wa.me which works both — no phone needed = generic share-sheet.
 */
export function buildWhatsAppShareUrl(opts: {
  subject: string;
  body: string;
}): string {
  const text = `${opts.subject}\n\n${opts.body}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function fallbackTemplate(input: NegotiatorInput, strategy: NegotiationStrategy, tonality: Tonality, language: Language): NegotiatorOutput {
  const greetingNL = tonality === "FORMEEL" ? "Geachte heer/mevrouw" : "Hallo";
  const greetingEN = tonality === "FORMEEL" ? "Dear Sir/Madam" : "Hi";
  const closingNL = tonality === "FORMEEL" ? "Met vriendelijke groet" : "Groet";
  const closingEN = tonality === "FORMEEL" ? "Kind regards" : "Best";

  if (language === "en") {
    return {
      subject: `Request: new proposal for my ${input.provider} account`,
      body: `${greetingEN},\n\nI've been a customer at ${input.provider} for some time. My current monthly amount is €${(input.currentMonthlyCents / 100).toFixed(2)}. I see better offers from competitors and would like to hear your proposal.\n\n${closingEN},\n${input.customerName}`,
      strategy,
      tonality,
      language,
      reasoning: "Fallback template — no LLM available.",
      expectedSavingsCents: input.alternatives[0]?.yearlySavingsCents ?? 0,
      confidence: 0.3,
    };
  }
  return {
    subject: `Verzoek: nieuw voorstel ${input.provider}`,
    body: `${greetingNL},\n\nIk ben sinds geruime tijd klant bij ${input.provider}. Mijn huidige maandbedrag is €${(input.currentMonthlyCents / 100).toFixed(2)}. Ik zie bij andere aanbieders gunstigere voorwaarden en hoor graag uw voorstel.\n\n${closingNL},\n${input.customerName}`,
    strategy,
    tonality,
    language,
    reasoning: "Fallback template — geen LLM beschikbaar.",
    expectedSavingsCents: input.alternatives[0]?.yearlySavingsCents ?? 0,
    confidence: 0.3,
  };
}

export async function generateEmail(input: NegotiatorInput): Promise<NegotiatorOutput> {
  const strategy = chooseStrategy(input);
  const tonality = input.tonality ?? "FORMEEL";
  const language = input.language ?? "nl";
  const fallback = fallbackTemplate(input, strategy, tonality, language);

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
    tonality,
    language,
    reasoning: parsed.reasoning ?? "",
    expectedSavingsCents: parsed.expectedSavingsCents ?? input.alternatives[0]?.yearlySavingsCents ?? 0,
    confidence: parsed.confidence ?? 0.5,
  };
}
