/**
 * Belt-and-braces contract tests for the v12 auto-pingpong activation.
 *
 * The user-confirm gate is a legal + ethical hard requirement. These
 * tests read the source files directly so a future refactor that
 * accidentally auto-sends a counter-mail without a manual click gets
 * blocked at CI time.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("auto-pingpong / never auto-sends to the provider", () => {
  it("inbound-router writes AWAITING_USER_CONFIRM, never ACCEPTED, on inbound counter", () => {
    const src = read("lib/inbound-router.ts");
    expect(src).toContain("AWAITING_USER_CONFIRM");
    expect(src).not.toMatch(/outcome:\s*"ACCEPTED"/);
  });

  it("inbound-router has exactly one sendEmail() call site (the user notification)", () => {
    const src = read("lib/inbound-router.ts");
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const occurrences = stripped.match(/sendEmail\(/g) ?? [];
    expect(occurrences.length).toBeLessThanOrEqual(1);
    if (occurrences.length === 1) {
      expect(src).toMatch(/to:\s*negotiation\.user\.email/);
    }
  });

  it("auto-pingpong dispatch never calls sendEmail() directly (delegates to inbound-router)", () => {
    const src = read("lib/auto-pingpong.ts");
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/sendEmail\(/);
  });
});

describe("auto-pingpong / confirm-send endpoint stays the only outbound path", () => {
  it("confirm-send rejects when outcome != AWAITING_USER_CONFIRM", () => {
    const src = read("app/api/negotiations/round/[id]/confirm-send/route.ts");
    expect(src).toMatch(/round\.outcome\s*!==\s*"AWAITING_USER_CONFIRM"/);
  });

  it("confirm-send is feature-flag gated behind FEATURE_AUTO_PINGPONG", () => {
    const src = read("app/api/negotiations/round/[id]/confirm-send/route.ts");
    expect(src).toMatch(/isEnabled\("AUTO_PINGPONG"\)/);
  });

  it("confirm-send requires authenticated session + ownership check", () => {
    const src = read("app/api/negotiations/round/[id]/confirm-send/route.ts");
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/userId\s*!==\s*session\.user\.id/);
  });
});

describe("auto-pingpong / webhook gating", () => {
  it("canonical handler Svix-verifies + 401s on invalid signature", () => {
    const src = read("lib/inbound-handler.ts");
    expect(src).toMatch(/verifyResendWebhook/);
    expect(src).toMatch(/status:\s*401/);
  });
  it("dispatch gates the negotiation branch behind AUTO_PINGPONG (no-op when off)", () => {
    const src = read("lib/auto-pingpong.ts");
    expect(src).toMatch(/isEnabled\("AUTO_PINGPONG"\)/);
    expect(src).toMatch(/feature-disabled/);
  });
});
