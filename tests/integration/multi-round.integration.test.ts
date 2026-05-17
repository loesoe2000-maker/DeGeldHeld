/**
 * Multi-round integration: real Groq text LLM analyses a real response.
 * SKIPPED unless GROQ_API_KEY_TEST set.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SKIP = !process.env.GROQ_API_KEY_TEST;

beforeAll(() => {
  if (SKIP) return;
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY_TEST;
});

describe.skipIf(SKIP)("integration: multi-round analysis with real Groq", () => {
  it("identifies a KPN counter-offer correctly via real LLM", async () => {
    const { analyseProviderResponse } = await import("@/lib/rounds");
    const text = fs.readFileSync(
      path.resolve(__dirname, "../fixtures/provider-responses/01-kpn-counter-offer.txt"),
      "utf-8",
    );
    const r = await analyseProviderResponse(text);
    expect(r.offers).toBe(true);
    // €22.50 ± €2 acceptance window
    expect(r.offeredCents).not.toBeNull();
    if (r.offeredCents != null) {
      expect(Math.abs(r.offeredCents - 2250)).toBeLessThanOrEqual(200);
    }
    expect(r.tone).toBe("constructief");
  });

  it("identifies a Vodafone NL rejection as walk_away", async () => {
    const { analyseProviderResponse } = await import("@/lib/rounds");
    const text = fs.readFileSync(
      path.resolve(__dirname, "../fixtures/provider-responses/02-vodafone-rejection.txt"),
      "utf-8",
    );
    const r = await analyseProviderResponse(text);
    expect(r.tone).toBe("afwijzend");
    expect(["walk_away", "escalate"]).toContain(r.action);
  });
});
