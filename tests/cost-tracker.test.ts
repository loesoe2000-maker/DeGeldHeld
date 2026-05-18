import { describe, it, expect, beforeEach } from "vitest";
import {
  costOfCall,
  recordGroqCost,
  todaySpentCents,
  __resetCostTracker,
  GROQ_TEXT_COST_PER_MTOK_CENTS,
  GROQ_VISION_COST_PER_MTOK_CENTS,
  DAILY_BUDGET_CENTS_WARN,
} from "@/lib/cost-tracker";

describe("v14 DEEL 9 — costOfCall pricing", () => {
  it("text-model price ≈ 60 cents per M tokens", () => {
    expect(GROQ_TEXT_COST_PER_MTOK_CENTS).toBe(60);
  });

  it("vision-model price ≈ 110 cents per M tokens", () => {
    expect(GROQ_VISION_COST_PER_MTOK_CENTS).toBe(110);
  });

  it("1M text tokens → 60 cents", () => {
    expect(
      costOfCall({ kind: "text", promptTokens: 500_000, completionTokens: 500_000 }),
    ).toBe(60);
  });

  it("100k vision tokens → 11 cents (rounded up)", () => {
    expect(
      costOfCall({ kind: "vision", promptTokens: 100_000, completionTokens: 0 }),
    ).toBe(11);
  });

  it("tiny call rounds up to 1 cent (no zero costs)", () => {
    expect(
      costOfCall({ kind: "text", promptTokens: 100, completionTokens: 200 }),
    ).toBe(1);
  });

  it("zero tokens → 0 cents", () => {
    expect(costOfCall({ kind: "text", promptTokens: 0, completionTokens: 0 })).toBe(0);
  });
});

describe("v14 DEEL 9 — recordGroqCost running total + warn-once", () => {
  beforeEach(() => {
    __resetCostTracker();
  });

  it("adds to today's running total", () => {
    recordGroqCost({ kind: "text", promptTokens: 1_000_000, completionTokens: 0 });
    expect(todaySpentCents()).toBeGreaterThan(0);
  });

  it("does not warn when below threshold", () => {
    const r = recordGroqCost({
      kind: "text",
      promptTokens: 100_000,
      completionTokens: 0,
    });
    expect(r.warned).toBe(false);
  });

  it("warns exactly once when crossing the threshold", () => {
    // Single big call that immediately crosses €50/day.
    const big = {
      kind: "vision" as const,
      promptTokens: 50_000_000,
      completionTokens: 0,
    };
    const r1 = recordGroqCost(big);
    expect(r1.warned).toBe(true);
    // Second call same day stays above threshold but does NOT re-warn.
    const r2 = recordGroqCost({ kind: "text", promptTokens: 1000, completionTokens: 0 });
    expect(r2.warned).toBe(false);
  });

  it("DAILY_BUDGET_CENTS_WARN matches doc (€50/day)", () => {
    expect(DAILY_BUDGET_CENTS_WARN).toBe(5000);
  });
});
