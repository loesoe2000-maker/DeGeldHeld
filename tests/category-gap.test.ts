import { describe, it, expect } from "vitest";
import { missingCategories, pickNudgeCategory, userPrimaryCategories } from "@/lib/category-gap";

describe("v21 category-gap", () => {
  it("maps legacy bill categories to their primary buckets", () => {
    const have = userPrimaryCategories(["TELECOM", "HYPOTHEEK", "STREAMING"]);
    expect(have.has("TELECOM")).toBe(true);
    expect(have.has("WONEN")).toBe(true); // HYPOTHEEK → WONEN
    expect(have.has("ABONNEMENTEN")).toBe(true); // STREAMING → ABONNEMENTEN
  });

  it("returns the categories a user has NOT covered (OVERIG excluded)", () => {
    const missing = missingCategories(["TELECOM"]);
    expect(missing).toContain("ENERGIE");
    expect(missing).toContain("VERZEKERING");
    expect(missing).not.toContain("TELECOM");
    expect(missing).not.toContain("OVERIG");
  });

  it("picks the highest-value missing category first (ENERGIE before ABONNEMENTEN)", () => {
    // user only has a streaming subscription → ENERGIE should be the nudge
    expect(pickNudgeCategory(["STREAMING"])).toBe("ENERGIE");
  });

  it("picks VERZEKERING when ENERGIE is already covered", () => {
    expect(pickNudgeCategory(["TELECOM", "ENERGIE"])).toBe("VERZEKERING");
  });

  it("returns null when the user covers every primary category", () => {
    const all = ["TELECOM", "ENERGIE", "VERZEKERING", "HYPOTHEEK", "BANK", "STREAMING"];
    expect(pickNudgeCategory(all)).toBeNull();
    expect(missingCategories(all)).toEqual([]);
  });
});
