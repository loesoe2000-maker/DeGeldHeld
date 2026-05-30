import { describe, it, expect } from "vitest";
import { buildProofBlobPath } from "@/lib/claim-proof-storage";

/**
 * v37 — bewijs-opslag pad-helper (pure). De feitelijke put() naar Vercel
 * Blob is best-effort IO en wordt niet in unit-tests geraakt.
 */
describe("buildProofBlobPath", () => {
  it("bevat claimType + userId + claimId in het pad", () => {
    const p = buildProofBlobPath(
      "Box3Claim",
      "user_abc",
      "claim_123",
      "beschikking.pdf",
      1_700_000_000_000,
    );
    expect(p).toBe(
      "claim-proofs/Box3Claim/user_abc/claim_123/1700000000000-beschikking.pdf",
    );
  });

  it("strip path-separators uit de filename (defense in depth)", () => {
    const p = buildProofBlobPath(
      "HuurServicekostenClaim",
      "u",
      "c",
      "../../etc/passwd",
      1,
    );
    expect(p).not.toMatch(/\.\./);
    expect(p.startsWith("claim-proofs/HuurServicekostenClaim/u/c/")).toBe(true);
  });

  it("kapt absurd lange bestandsnamen af", () => {
    const long = "x".repeat(500) + ".pdf";
    const p = buildProofBlobPath("EnergieEindafrekeningClaim", "u", "c", long, 1);
    const filenamePart = p.split("/").pop() ?? "";
    // timestamp-prefix (2 chars: "1-") + max 200 chars naam
    expect(filenamePart.length).toBeLessThanOrEqual(2 + 200);
  });

  it("per claim-type een eigen prefix", () => {
    const types = [
      "Box3Claim",
      "HuurServicekostenClaim",
      "EnergieEindafrekeningClaim",
    ] as const;
    for (const t of types) {
      const p = buildProofBlobPath(t, "u", "c", "f.pdf", 1);
      expect(p.startsWith(`claim-proofs/${t}/`)).toBe(true);
    }
  });
});
