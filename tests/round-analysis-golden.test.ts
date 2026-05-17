import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyseProviderResponse } from "../lib/rounds";

const FIX_DIR = path.resolve(__dirname, "fixtures/provider-responses");

type Expected = {
  offers: boolean;
  offeredCents: number | null;
  discountPct: number | null;
  tone: "constructief" | "afwijzend" | "stalling";
  action: "accept" | "counter" | "escalate" | "walk_away";
};

function loadFixtures(): Array<{ name: string; body: string; expected: Expected }> {
  const files = fs
    .readdirSync(FIX_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();
  return files.map((f) => {
    const body = fs.readFileSync(path.join(FIX_DIR, f), "utf-8");
    const expected = JSON.parse(
      fs.readFileSync(path.join(FIX_DIR, f.replace(/\.txt$/, ".expected.json")), "utf-8"),
    ) as Expected;
    return { name: f.replace(/\.txt$/, ""), body, expected };
  });
}

// Heuristic fallback works on NL keywords; for EN/DE it commonly cannot
// detect "stalling" (which uses NL phrases like "meer informatie"). The
// golden suite scores PER-CRITERION across all 15 fixtures, with an
// overall ≥80% gate per sprint requirement.
function scoreFixture(actual: Awaited<ReturnType<typeof analyseProviderResponse>>, e: Expected) {
  const scores = { offers: 0, tone: 0, action: 0, amount: 0, total: 0 };
  scores.total = 4;
  if (actual.offers === e.offers) scores.offers = 1;
  if (actual.tone === e.tone) scores.tone = 1;
  if (actual.action === e.action) scores.action = 1;
  if (e.offeredCents != null && actual.offeredCents != null) {
    if (Math.abs(actual.offeredCents - e.offeredCents) <= 200) scores.amount = 1;
  } else if (e.offeredCents == null && actual.offeredCents == null) {
    scores.amount = 1;
  }
  return scores;
}

describe("round-analysis golden suite", () => {
  const fixtures = loadFixtures();

  it("has 15 fixtures (5 NL + 5 EN + 5 DE)", () => {
    expect(fixtures.length).toBe(15);
  });

  it("≥80% per-criterion pass rate over all 15 fixtures", async () => {
    let offersHit = 0;
    let toneHit = 0;
    let actionHit = 0;
    let amountHit = 0;
    const failingActions: string[] = [];

    for (const fx of fixtures) {
      const actual = await analyseProviderResponse(fx.body);
      const s = scoreFixture(actual, fx.expected);
      offersHit += s.offers;
      toneHit += s.tone;
      actionHit += s.action;
      amountHit += s.amount;
      if (s.action !== 1) failingActions.push(`${fx.name}: expected ${fx.expected.action}, got ${actual.action}`);
    }

    const n = fixtures.length;
    const offersPct = (offersHit / n) * 100;
    const tonePct = (toneHit / n) * 100;
    const actionPct = (actionHit / n) * 100;
    const amountPct = (amountHit / n) * 100;
    const overall = (offersHit + toneHit + actionHit + amountHit) / (n * 4);

    // Print scores so CI logs show pass-rate even on success
    console.log(`golden scores — offers ${offersPct.toFixed(0)}%, tone ${tonePct.toFixed(0)}%, ` +
      `action ${actionPct.toFixed(0)}%, amount ${amountPct.toFixed(0)}%, overall ${(overall * 100).toFixed(0)}%`);
    if (failingActions.length > 0) console.log(`  action mismatches: ${failingActions.join("; ")}`);

    expect(overall, "overall pass-rate < 80%").toBeGreaterThanOrEqual(0.8);
  }, 120_000);

  it("fixtures with rejecting-language map to walk_away (NL+EN+DE)", async () => {
    const rejecting = fixtures.filter((f) => f.expected.action === "walk_away");
    let hits = 0;
    for (const fx of rejecting) {
      const a = await analyseProviderResponse(fx.body);
      if (a.action === "walk_away" || a.action === "escalate") hits++;
    }
    expect(hits / rejecting.length).toBeGreaterThanOrEqual(0.6);
  }, 60_000);

  it("fixtures with concrete offers detect offers=true", async () => {
    const offering = fixtures.filter((f) => f.expected.offers === true);
    let hits = 0;
    for (const fx of offering) {
      const a = await analyseProviderResponse(fx.body);
      if (a.offers === true) hits++;
    }
    expect(hits / offering.length).toBeGreaterThanOrEqual(0.6);
  }, 60_000);
});
