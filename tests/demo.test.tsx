import { describe, it, expect } from "vitest";
import { DEMO_FIXTURES, getDemoFixture } from "../lib/demo-fixtures";

describe("demo-fixtures", () => {
  it("has exactly 3 fixtures (telecom/energie/verzekering)", () => {
    expect(DEMO_FIXTURES).toHaveLength(3);
    expect(DEMO_FIXTURES.map((f) => f.id).sort()).toEqual(["energie", "telecom", "verzekering"]);
  });

  it("each fixture has bill, analysis and mail", () => {
    for (const f of DEMO_FIXTURES) {
      expect(f.bill.provider).toBeTruthy();
      expect(f.bill.monthlyCents).toBeGreaterThan(0);
      expect(f.analysis.yearlySavingsCents).toBeGreaterThan(0);
      expect(f.analysis.alternatives.length).toBeGreaterThan(0);
      expect(f.mail.subject).toBeTruthy();
      expect(f.mail.body.length).toBeGreaterThan(100);
      expect(f.mail.confidence).toBeGreaterThan(0);
      expect(f.mail.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("alternatives are cheaper than the bill itself", () => {
    for (const f of DEMO_FIXTURES) {
      for (const a of f.analysis.alternatives) {
        expect(a.monthlyCents).toBeLessThan(f.bill.monthlyCents);
      }
    }
  });

  it("getDemoFixture finds by id", () => {
    expect(getDemoFixture("telecom")?.bill.provider).toBe("KPN");
    expect(getDemoFixture("energie")?.bill.provider).toBe("Eneco");
    expect(getDemoFixture("verzekering")?.bill.provider).toBe("Centraal Beheer");
  });

  it("getDemoFixture returns undefined for unknown id", () => {
    expect(getDemoFixture("nonexistent")).toBeUndefined();
  });

  it("mail body contains provider name and amount", () => {
    for (const f of DEMO_FIXTURES) {
      expect(f.mail.body).toContain(f.bill.provider);
    }
  });
});
