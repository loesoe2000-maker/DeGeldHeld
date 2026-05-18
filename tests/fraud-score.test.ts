import { describe, it, expect } from "vitest";
import {
  suspicionScore,
  isFlaggable,
  FRAUD_FLAG_THRESHOLD,
  DISPOSABLE_DOMAINS,
} from "@/lib/fraud-detection";

const baseline = {
  email: "bart@example.com",
  unverifiedClaims30d: 0,
  totalClaims: 0,
  verifiedClaims: 0,
  distinctProviders: 0,
  duplicateImageHashes: 0,
};

describe("suspicionScore — 6 representative patterns", () => {
  it("legit first-time user → 0", () => {
    const r = suspicionScore(baseline);
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
    expect(isFlaggable(r)).toBe(false);
  });

  it("user with 6 unverified claims in 30d (but 2 verified earlier) → +30 only, not yet flaggable", () => {
    const r = suspicionScore({
      ...baseline,
      unverifiedClaims30d: 6,
      totalClaims: 8,
      verifiedClaims: 2, // suppresses the 0-verified-of-N rule
    });
    expect(r.score).toBe(30);
    expect(isFlaggable(r)).toBe(false);
  });

  it("never-verified user with 3+ closed claims → +25", () => {
    const r = suspicionScore({
      ...baseline,
      totalClaims: 4,
      verifiedClaims: 0,
    });
    expect(r.score).toBe(25);
  });

  it("duplicate imageHash → +50 (auto-flagged)", () => {
    const r = suspicionScore({ ...baseline, duplicateImageHashes: 1 });
    expect(r.score).toBe(50);
    expect(isFlaggable(r)).toBe(true);
  });

  it("disposable email domain → +40", () => {
    const r = suspicionScore({ ...baseline, email: "user@mailinator.com" });
    expect(r.score).toBe(40);
    expect(r.reasons.join(" ")).toMatch(/disposable/);
  });

  it("compounded: disposable email + dup-hash + unverified spam → caps at 100", () => {
    const r = suspicionScore({
      email: "x@yopmail.com",
      unverifiedClaims30d: 10,
      totalClaims: 10,
      verifiedClaims: 0,
      distinctProviders: 1,
      duplicateImageHashes: 3,
    });
    // 30 + 50 + 25 + 40 = 145 → clamped to 100
    expect(r.score).toBe(100);
    expect(r.reasons.length).toBe(4);
    expect(isFlaggable(r)).toBe(true);
  });
});

describe("FRAUD_FLAG_THRESHOLD + DISPOSABLE_DOMAINS contracts", () => {
  it("threshold is exactly 50 (matches admin-panel copy)", () => {
    expect(FRAUD_FLAG_THRESHOLD).toBe(50);
  });

  it("disposable list contains the well-known offenders", () => {
    expect(DISPOSABLE_DOMAINS.has("mailinator.com")).toBe(true);
    expect(DISPOSABLE_DOMAINS.has("guerrillamail.com")).toBe(true);
    expect(DISPOSABLE_DOMAINS.has("yopmail.com")).toBe(true);
  });

  it("scoring is deterministic for identical input", () => {
    const a = suspicionScore({ ...baseline, duplicateImageHashes: 2 });
    const b = suspicionScore({ ...baseline, duplicateImageHashes: 2 });
    expect(a).toEqual(b);
  });
});
