import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Belt-and-braces tests for the user-confirm gate. We test the
 * SOURCE FILES directly so the contract holds at the file-level —
 * future refactors that drop the AWAITING_USER_CONFIRM state, the
 * confirm-send route, or accidentally auto-call sendEmail() to a
 * provider from the inbound router get caught by CI.
 *
 * This is a complement to (not replacement for) integration tests
 * that exercise the wire protocol.
 */

const ROOT = resolve(__dirname, "..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("user-confirm gate / inbound-router never auto-sends to provider", () => {
  const src = read("lib/inbound-router.ts");

  it("writes AWAITING_USER_CONFIRM, not ACCEPTED, on inbound counter", () => {
    expect(src).toContain("AWAITING_USER_CONFIRM");
    // The router must NOT set outcome to ACCEPTED — that's the
    // confirm-send endpoint's responsibility.
    expect(src).not.toMatch(/outcome:\s*"ACCEPTED"/);
  });

  it("only sends mail to the user (notification), never to the provider's address", () => {
    // Strip block + line comments before counting call sites — comments
    // mentioning "sendEmail()" are docs, not invocations.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const occurrences = stripped.match(/sendEmail\(/g) ?? [];
    expect(occurrences.length).toBeLessThanOrEqual(1);
    if (occurrences.length === 1) {
      expect(src).toMatch(/to:\s*negotiation\.user\.email/);
    }
  });
});

describe("user-confirm gate / confirm-send is the only outbound path", () => {
  const src = read("app/api/negotiations/round/[id]/confirm-send/route.ts");

  it("rejects when outcome != AWAITING_USER_CONFIRM", () => {
    expect(src).toContain("AWAITING_USER_CONFIRM");
    expect(src).toMatch(/round\.outcome\s*!==\s*"AWAITING_USER_CONFIRM"/);
  });

  it("requires an authenticated session", () => {
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/session\?\.user\?\.id/);
  });

  it("validates the user owns the round", () => {
    expect(src).toMatch(/round\.negotiation\.userId\s*!==\s*session\.user\.id/);
  });

  it("is gated behind FEATURE_AUTO_PINGPONG", () => {
    expect(src).toMatch(/isEnabled\("AUTO_PINGPONG"\)/);
  });
});

describe("user-confirm gate / webhook is signature-gated and feature-flagged", () => {
  it("canonical handler verifies the Svix signature before doing anything", () => {
    const src = read("lib/inbound-handler.ts");
    expect(src).toMatch(/verifyResendWebhook/);
    expect(src).toMatch(/status:\s*401/);
  });
  it("negotiation branch is gated behind AUTO_PINGPONG (no-op when off)", () => {
    const src = read("lib/auto-pingpong.ts");
    expect(src).toMatch(/isEnabled\("AUTO_PINGPONG"\)/);
  });
});
