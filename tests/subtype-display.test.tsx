import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Comparison from "@/components/Comparison";
import type { ComparisonResult } from "@/lib/comparison";

function fakeResult(): ComparisonResult {
  return {
    current: { provider: "Eneco", category: "ENERGIE", amountCents: 17000 },
    topAlternatives: [],
    bestSavingsCents: 0,
    bestSavingsPct: 0,
    marketRange: { minCents: 10000, maxCents: 20000, medianCents: 15000, userPercentile: 75, sampleSize: 10 },
    confidencePct: 80,
  };
}

describe("Comparison subType chip", () => {
  it("renders chip when subType is set", () => {
    render(<Comparison result={fakeResult()} subType="stroom+gas" />);
    const chip = screen.getByTestId("subtype-chip");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toBe("stroom+gas");
  });

  it("does NOT render chip when subType is null", () => {
    render(<Comparison result={fakeResult()} subType={null} />);
    expect(screen.queryByTestId("subtype-chip")).toBeNull();
  });

  it("does NOT render chip when subType is missing", () => {
    render(<Comparison result={fakeResult()} />);
    expect(screen.queryByTestId("subtype-chip")).toBeNull();
  });
});
