/**
 * Multi-round negotiation logic.
 *
 * After the user emails the provider, they paste the response and we analyse:
 *  - does the provider offer anything? how much?
 *  - tone: constructief | afwijzend | stalling
 *  - advice: accept | counter | escalate | walk_away
 *
 * Capped at MAX_ROUNDS=3 — beyond that, escalate to walk-away.
 */

import Groq from "groq-sdk";

export const MAX_ROUNDS = 3;

export type RoundTone = "constructief" | "afwijzend" | "stalling";
export type RoundAction = "accept" | "counter" | "escalate" | "walk_away";

export type RoundAnalysis = {
  offers: boolean;
  offeredCents: number | null;
  discountPct: number | null;
  tone: RoundTone;
  action: RoundAction;
  reasoning: string;
};

const apiKey = process.env.GROQ_API_KEY ?? "";
const textModel = process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile";

let _client: Groq | null = null;
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey });
  return _client;
}

const SYSTEM_PROMPT = `Je analyseert een antwoord van een provider op een
onderhandel-mail van een Nederlandse consument.

Extraheer:
  - offers: boolean — biedt de provider concreet iets aan?
  - offered_eur: number | null — nieuw maandbedrag in EUR (null als geen aanbod)
  - discount_pct: number | null — korting-percentage 0-100 (null als geen aanbod)
  - tone: "constructief" | "afwijzend" | "stalling"
       constructief = biedt iets concreets, opent gesprek
       afwijzend = wijst af, sluit deur
       stalling = vraagt om meer info / verwijst door / geen toezegging
  - action: "accept" | "counter" | "escalate" | "walk_away"
       accept = aanbod is goed genoeg (>10% korting)
       counter = aanbod te laag of niet concreet — vraag meer
       escalate = afwijzend maar nog ruimte (vraag senior / klacht)
       walk_away = afwijzend, geen ruimte meer — overstap
  - reasoning: 1-2 zinnen waarom

Antwoord ALLEEN in JSON, geen markdown.

Voorbeeld:
{"offers":true,"offered_eur":22.50,"discount_pct":15,"tone":"constructief","action":"counter","reasoning":"€22,50 is een opening maar nog €3 boven concurrent — vraag matching."}`;

function toCents(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

function clampPct(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, v));
}

function isTone(v: unknown): v is RoundTone {
  return v === "constructief" || v === "afwijzend" || v === "stalling";
}

function isAction(v: unknown): v is RoundAction {
  return v === "accept" || v === "counter" || v === "escalate" || v === "walk_away";
}

export function parseAnalysisJson(raw: string): RoundAnalysis | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const tone = isTone(obj.tone) ? obj.tone : "stalling";
    const action = isAction(obj.action) ? obj.action : "counter";
    return {
      offers: typeof obj.offers === "boolean" ? obj.offers : false,
      offeredCents: toCents(obj.offered_eur),
      discountPct: clampPct(obj.discount_pct),
      tone,
      action,
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
    };
  } catch {
    return null;
  }
}

function fallbackAnalysis(response: string): RoundAnalysis {
  const lower = response.toLowerCase();
  const rejecting = /(helaas|niet mogelijk|kunnen niet|geen mogelijkheid|afwijz)/i.test(lower);
  const offering = /(\d+(?:[.,]\d{2})?\s*(?:euro|€)|aanbieden|korting van|nieuwe prijs)/i.test(lower);
  const stalling = /(meer informatie|nemen contact|kunt u verduidelijken|na overleg)/i.test(lower);

  let tone: RoundTone = "stalling";
  let action: RoundAction = "counter";
  if (offering) {
    tone = "constructief";
    action = "counter";
  } else if (rejecting) {
    tone = "afwijzend";
    action = "walk_away";
  } else if (stalling) {
    tone = "stalling";
    action = "escalate";
  }

  return {
    offers: offering,
    offeredCents: null,
    discountPct: null,
    tone,
    action,
    reasoning: "Heuristische analyse (LLM niet beschikbaar).",
  };
}

export async function analyseProviderResponse(response: string): Promise<RoundAnalysis> {
  if (!response || response.trim().length < 10) {
    return {
      offers: false,
      offeredCents: null,
      discountPct: null,
      tone: "stalling",
      action: "counter",
      reasoning: "Te kort antwoord om te analyseren.",
    };
  }

  if (!apiKey || apiKey === "gsk_test_dummy") {
    return fallbackAnalysis(response);
  }

  try {
    const resp = await client().chat.completions.create({
      model: textModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: response.slice(0, 4000) },
      ],
      max_tokens: 300,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const raw = resp.choices[0]?.message?.content ?? "";
    const parsed = parseAnalysisJson(raw);
    if (parsed) return parsed;
  } catch {
    /* fall through to fallback */
  }

  return fallbackAnalysis(response);
}

/**
 * Map round action → state machine target.
 */
export function actionToState(action: RoundAction):
  | "ACCEPTED"
  | "REJECTED"
  | "COUNTER_SENT"
  | "RESPONSE_RECEIVED" {
  switch (action) {
    case "accept":
      return "ACCEPTED";
    case "walk_away":
      return "REJECTED";
    case "counter":
      return "COUNTER_SENT";
    case "escalate":
      return "RESPONSE_RECEIVED";
  }
}

/**
 * Counter-prompt context: dwingt de mail om het vorige aanbod expliciet te noemen.
 */
export function buildCounterContext(opts: {
  roundNumber: number;
  previousOfferedCents: number | null;
  previousTone: RoundTone;
}): string {
  const offer =
    opts.previousOfferedCents != null
      ? `€${(opts.previousOfferedCents / 100).toFixed(2).replace(".", ",")}`
      : "geen concreet bedrag";
  return `Dit is ronde ${opts.roundNumber} van de onderhandeling. De provider's vorige aanbod was ${offer} (tone: ${opts.previousTone}). Verwijs in de counter-mail expliciet naar dit aanbod, bedank kort voor het voorstel, en vraag om verdere verlaging — wees concreet met je nieuwe doelbedrag.`;
}
