import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  parseAnalysisJson,
  actionToState,
  analyseProviderResponse,
  MAX_ROUNDS,
} from "@/lib/rounds";

describe("rounds — analysis parsing", () => {
  it("parses constructief €22 offer correctly", () => {
    const raw = JSON.stringify({
      offers: true,
      offered_eur: 22.5,
      discount_pct: 15,
      tone: "constructief",
      action: "counter",
      reasoning: "Goede opening maar te hoog.",
    });
    const parsed = parseAnalysisJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.offers).toBe(true);
    expect(parsed!.offeredCents).toBe(2250);
    expect(parsed!.tone).toBe("constructief");
    expect(parsed!.action).toBe("counter");
  });

  it("parses stalling response with null offer", () => {
    const raw = JSON.stringify({
      offers: false,
      offered_eur: null,
      discount_pct: null,
      tone: "stalling",
      action: "escalate",
      reasoning: "Verwijst door zonder bedrag.",
    });
    const parsed = parseAnalysisJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.offeredCents).toBeNull();
    expect(parsed!.tone).toBe("stalling");
    expect(parsed!.action).toBe("escalate");
  });

  it("parses afwijzend response → walk_away", () => {
    const raw = JSON.stringify({
      offers: false,
      offered_eur: null,
      discount_pct: 0,
      tone: "afwijzend",
      action: "walk_away",
      reasoning: "Definitieve afwijzing.",
    });
    const parsed = parseAnalysisJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.action).toBe("walk_away");
    expect(parsed!.tone).toBe("afwijzend");
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n" +
      JSON.stringify({ offers: true, offered_eur: 19.99, tone: "constructief", action: "accept" }) +
      "\n```";
    const parsed = parseAnalysisJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.offeredCents).toBe(1999);
    expect(parsed!.action).toBe("accept");
  });

  it("returns null on malformed JSON", () => {
    expect(parseAnalysisJson("not json")).toBeNull();
    expect(parseAnalysisJson("{\"oops\": ")).toBeNull();
  });

  it("clamps discount_pct to 0-100", () => {
    const raw = JSON.stringify({
      offers: true,
      offered_eur: 10,
      discount_pct: 250,
      tone: "constructief",
      action: "accept",
    });
    const parsed = parseAnalysisJson(raw);
    expect(parsed!.discountPct).toBe(100);
  });

  it("defaults invalid tone/action to safe values", () => {
    const raw = JSON.stringify({
      offers: true,
      offered_eur: 10,
      tone: "weird",
      action: "boom",
    });
    const parsed = parseAnalysisJson(raw);
    expect(parsed!.tone).toBe("stalling");
    expect(parsed!.action).toBe("counter");
  });
});

describe("rounds — action → state mapping", () => {
  it("maps accept → ACCEPTED", () => {
    expect(actionToState("accept")).toBe("ACCEPTED");
  });
  it("maps walk_away → REJECTED", () => {
    expect(actionToState("walk_away")).toBe("REJECTED");
  });
  it("maps counter → COUNTER_SENT", () => {
    expect(actionToState("counter")).toBe("COUNTER_SENT");
  });
  it("maps escalate → RESPONSE_RECEIVED", () => {
    expect(actionToState("escalate")).toBe("RESPONSE_RECEIVED");
  });
});

describe("rounds — heuristic fallback (no API key)", () => {
  const prevKey = process.env.GROQ_API_KEY;
  beforeAll(() => {
    process.env.GROQ_API_KEY = "gsk_test_dummy";
  });
  afterAll(() => {
    if (prevKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prevKey;
  });

  it("detects offer-language → constructief + counter", async () => {
    const r = await analyseProviderResponse(
      "We kunnen u een korting van 15% aanbieden, nieuwe prijs €22,50 per maand.",
    );
    expect(r.tone).toBe("constructief");
    expect(r.action).toBe("counter");
    expect(r.offers).toBe(true);
  });

  it("detects rejecting language → afwijzend + walk_away", async () => {
    const r = await analyseProviderResponse(
      "Helaas, het is niet mogelijk om uw maandbedrag te verlagen.",
    );
    expect(r.tone).toBe("afwijzend");
    expect(r.action).toBe("walk_away");
  });

  it("detects stalling → escalate", async () => {
    const r = await analyseProviderResponse(
      "Wij nemen contact op met onze backoffice voor meer informatie.",
    );
    expect(r.tone).toBe("stalling");
    expect(r.action).toBe("escalate");
  });

  it("very short response is non-analyzable", async () => {
    const r = await analyseProviderResponse("ok");
    expect(r.reasoning).toContain("Te kort");
  });
});

describe("rounds — constants", () => {
  it("MAX_ROUNDS is 3", () => {
    expect(MAX_ROUNDS).toBe(3);
  });
});
