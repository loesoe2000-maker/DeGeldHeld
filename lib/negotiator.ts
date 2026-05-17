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
import { ruleFor } from "@/lib/categories";

export type NegotiationStrategy =
  | "RETENTIE_DREIG"
  | "SWITCH_CLAIM"
  | "LOYALTY"
  | "NIEUWE_KLANT_VERGELIJK"
  | "LANGETERMIJN_KORTING";

export type Tonality = "FORMEEL" | "CASUAL";
export type Language = "nl" | "en" | "de" | "fr";

export type NegotiatorInput = {
  customerName: string;
  customerEmail?: string;
  provider: string;
  category: string;
  currentPlan: string | null;
  currentMonthlyCents: number;
  /** Klantnummer uit OCR (optional). Retentie zoekt hierop op = veel sneller behandeld. */
  customerNumber?: string | null;
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
// Groq deprecated llama-3.1-70b-versatile in 2025. Use the current text model.
const textModel = process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile";

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

  const LANG_LABEL: Record<Language, string> = {
    nl: "Nederlandse",
    en: "Engelse",
    de: "Duitse",
    fr: "Franse",
  };
  const FORMEEL_LABEL: Record<Language, string> = {
    nl: "u-vorm, beleefd-formeel",
    en: "polite, formal",
    de: "Sie-Form, höflich-formell",
    fr: "vouvoiement, poli et formel",
  };
  const CASUAL_LABEL: Record<Language, string> = {
    nl: "je-vorm, vriendelijk-direct",
    en: "casual, direct but friendly",
    de: "du-Form, freundlich-direkt",
    fr: "tutoiement, direct et amical",
  };
  const NATIVE_NAME: Record<Language, string> = {
    nl: "Nederlands",
    en: "English",
    de: "Deutsch",
    fr: "français",
  };
  const langLabel = LANG_LABEL[language];
  const tonalityLabel = tonality === "FORMEEL" ? FORMEEL_LABEL[language] : CASUAL_LABEL[language];

  const system = `Je bent een ${langLabel} onderhandelings-assistent voor Nederlandse
consumenten. Je schrijft een professionele e-mail aan het retentie-/klantbehoud-team
van een provider om het maandbedrag te verlagen.

Stijl: ${tonalityLabel}, 150-220 woorden — lang genoeg om overtuigend te zijn,
kort genoeg om gelezen te worden.
Taal: ${NATIVE_NAME[language]}.

VERPLICHTE elementen in de mail (in deze volgorde):
1. Aanhef + verwijzing naar klantnummer (als gegeven, anders "mijn account").
2. Loyaliteits-anker: hoe lang klant + huidig pakket + huidig bedrag.
3. Concrete marktvergelijking: benoem MINSTENS ÉÉN concurrent met naam +
   bedrag dat je kreeg (uit "Goedkopere alternatieven"). Niet vaag —
   noem het bedrag en de provider.
4. Concreet verzoek: vraag om een specifiek nieuw maandbedrag (target = ~10-20%
   onder huidige, of het concurrent-bedrag + €2). NIET vragen om "een voorstel" —
   noem je gewenste bedrag.
5. Switch-dreiging: zeg expliciet dat je anders overstapt binnen 30 dagen.
6. Deadline: vraag om reactie binnen 14 werkdagen.
7. Afsluiting met naam en contact.

Stijl-regels:
- Géén excuses of onderdanige toon ("ik zou het op prijs stellen…" → fout).
- Géén overdrijving of dreigtoon — zakelijk, feitelijk.
- Géén bullet points in de body, gewoon paragrafen.
- Géén emoji, géén markdown.

Antwoord in JSON met velden:
  subject (string, max 70 chars, bevat provider-naam en "voorstel" of "tarief"),
  body (string, met \\n als regelovergangen, geen markdown),
  reasoning (string, 1-2 zinnen waarom deze hoek werkt voor deze provider),
  expected_savings_eur_yearly (number, jaarbesparing in euro),
  confidence (0-1, hoe sterk is deze case).`;

  const altSummary = input.alternatives
    .slice(0, 3)
    .map(
      (a) =>
        `${a.plan.provider} ${a.plan.name} = €${(a.plan.priceCents / 100).toFixed(2)}/mnd`,
    )
    .join("; ");

  // NL en EN hebben uitgewerkte strategie-tekst; DE/FR vallen terug op EN
  // zodat de model de strategie-kern begrijpt, maar de body in DE/FR schrijft.
  const strategyDescriptions = language === "nl" ? STRATEGY_DESCRIPTIONS_NL : STRATEGY_DESCRIPTIONS_EN;
  const strategyDesc = strategyDescriptions[strategy];

  // Category-specific playbook: bv hypotheek vraagt om rente-reductie, niet
  // "switch binnen 30 dagen" zoals telecom.
  const catRule = ruleFor(input.category as never);
  const categoryHint = catRule.negotiable ? catRule.negotiationPlaybook : "";

  // Target = beste alternatief +€2 buffer, of 15% korting op huidig als geen alt.
  const targetCents = best
    ? best.plan.priceCents + 200
    : Math.round(input.currentMonthlyCents * 0.85);

  const user = `Klant: ${input.customerName}
${input.customerEmail ? `Email: ${input.customerEmail}` : ""}
${input.customerNumber ? `Klantnummer: ${input.customerNumber}` : "Klantnummer: niet beschikbaar"}
Provider: ${input.provider}
Categorie: ${input.category}
Huidig pakket: ${input.currentPlan ?? "onbekend"}
Huidig bedrag: €${(input.currentMonthlyCents / 100).toFixed(2)}/maand
Klant sinds: ${input.customerYears ? `${input.customerYears} jaar` : "geruime tijd"}
Strategie: ${strategy} — ${strategyDesc}

Goedkopere alternatieven (gebruik er minstens één concreet in de mail):
${altSummary || "geen — gebruik markt-mediaan als argument"}

Gewenst nieuw bedrag: €${(targetCents / 100).toFixed(2)}/maand
Beste alternatief jaarlijkse besparing: €${best ? (best.yearlySavingsCents / 100).toFixed(0) : "0"}
${hint ? `Provider-tip: ${hint}` : ""}
${categoryHint ? `Categorie-tip (${catRule.label}): ${categoryHint}` : ""}

Schrijf de e-mail volgens de strategie en de 7 verplichte elementen. Wees concreet
en feitelijk. Noem expliciet "${input.provider}" in de body.`;

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

  const huidig = (input.currentMonthlyCents / 100).toFixed(2).replace(".", ",");
  const best = input.alternatives[0];
  const altCents = best ? best.plan.priceCents : Math.round(input.currentMonthlyCents * 0.8);
  const altPrice = (altCents / 100).toFixed(2).replace(".", ",");
  const altProvider = best?.plan.provider ?? "een concurrent";
  const altName = best?.plan.name ?? "";
  const targetCents = best ? best.plan.priceCents + 200 : Math.round(input.currentMonthlyCents * 0.85);
  const targetPrice = (targetCents / 100).toFixed(2).replace(".", ",");
  const yearSaved = best ? Math.round(best.yearlySavingsCents / 100) : Math.round(input.currentMonthlyCents * 12 * 0.15 / 100);
  const klantnummerNL = input.customerNumber ? ` (klantnummer ${input.customerNumber})` : "";
  const klantnummerEN = input.customerNumber ? ` (customer number ${input.customerNumber})` : "";
  const planLine = input.currentPlan ? ` op het pakket "${input.currentPlan}"` : "";

  if (language === "en") {
    const body = `${greetingEN},

I'm writing about my ${input.provider} account${klantnummerEN}. I have been a customer for several years${planLine ? ` on plan "${input.currentPlan}"` : ""}, with a current monthly bill of €${huidig}.

I have compared my contract with the current market. ${altProvider} currently offers ${altName || "a comparable package"} for €${altPrice} per month — that is €${yearSaved} per year less than what I pay you. Other providers offer similar deals.

I value continuity, so I'd prefer to stay with ${input.provider}. I therefore ask you to bring my monthly amount down to €${targetPrice}. If that is not possible, I will switch within 30 days.

I look forward to your concrete proposal within 14 working days at this email address.

${closingEN},
${input.customerName}${input.customerEmail ? `\n${input.customerEmail}` : ""}`;
    return {
      subject: `Request to revise ${input.provider} tariff${klantnummerEN}`,
      body,
      strategy,
      tonality,
      language,
      reasoning: "Fallback template (no LLM) — but with concrete alternative, target amount and 14-day deadline.",
      expectedSavingsCents: best?.yearlySavingsCents ?? Math.round(input.currentMonthlyCents * 12 * 0.15),
      confidence: 0.45,
    };
  }

  const body = `${greetingNL},

Ik schrijf u over mijn ${input.provider}-account${klantnummerNL}. Ik ben al meerdere jaren klant${planLine}, met een huidig maandbedrag van €${huidig}.

Ik heb mijn contract vergeleken met het huidige marktaanbod. ${altProvider} biedt momenteel ${altName || "een vergelijkbaar pakket"} aan voor €${altPrice} per maand — dat is €${yearSaved} per jaar minder dan wat ik nu bij u betaal. Ook andere aanbieders bieden soortgelijke tarieven.

Ik hecht waarde aan continuïteit en blijf liever bij ${input.provider}. Daarom vraag ik u mijn maandbedrag te verlagen naar €${targetPrice}. Indien dat niet mogelijk is, zal ik binnen 30 dagen overstappen.

Ik ontvang graag uw concrete voorstel binnen 14 werkdagen op dit e-mailadres.

${closingNL},
${input.customerName}${input.customerEmail ? `\n${input.customerEmail}` : ""}`;

  return {
    subject: `Verzoek tariefherziening ${input.provider}${klantnummerNL}`,
    body,
    strategy,
    tonality,
    language,
    reasoning: "Fallback template (geen LLM) — maar met concreet alternatief, doelbedrag en 14-dagen deadline.",
    expectedSavingsCents: best?.yearlySavingsCents ?? Math.round(input.currentMonthlyCents * 12 * 0.15),
    confidence: 0.45,
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
