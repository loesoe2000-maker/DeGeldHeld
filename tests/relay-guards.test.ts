import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FLAG_DEFAULTS } from "@/lib/feature-flags";

/**
 * v23/v25 — source-level anti-abuse + consent invariants. The route behaviour
 * (pause/resume, flag-gate, owner-scope) is exercised in relay-pause.test.ts,
 * relay-authorize.test.ts and relay-approve.test.ts; here we lock the
 * structural guarantees that must never silently regress.
 */
describe("v23 anti-abuse — source-level invariants", () => {
  const root = resolve(__dirname, "..");
  const read = (p: string) => readFileSync(resolve(root, p), "utf8");

  it("relay-authorize is owner-scoped (findFirst with userId)", () => {
    const src = read("app/api/negotiations/[id]/relay-authorize/route.ts");
    expect(src).toMatch(/findFirst\(\{\s*where:\s*\{\s*id,\s*userId\s*\}/);
  });
  it("relay-approve + relay-pause are owner-scoped", () => {
    for (const p of [
      "app/api/negotiations/[id]/relay-approve/route.ts",
      "app/api/negotiations/[id]/relay-pause/route.ts",
    ]) {
      expect(read(p)).toMatch(/where:\s*\{\s*id,\s*userId\s*\}/);
    }
  });
  it("every relay entrypoint is gated by isEnabled('RELAY_ENABLED')", () => {
    for (const p of [
      "app/api/negotiations/[id]/relay-authorize/route.ts",
      "app/api/negotiations/[id]/relay-approve/route.ts",
      "app/api/negotiations/[id]/relay-pause/route.ts",
    ]) {
      expect(read(p)).toMatch(/isEnabled\(["']RELAY_ENABLED["']\)/);
    }
  });
  it("relay-authorize requires a fee-card + accepted mandate (GUARDRAIL 4)", () => {
    const src = read("app/api/negotiations/[id]/relay-authorize/route.ts");
    expect(src).toMatch(/feePaymentMethodId/);
    expect(src).toMatch(/feeMandateAcceptedAt/);
    expect(src).toMatch(/card-required/);
  });
  it("inbound relay routes ONLY by the unique relay token (token-scoped)", () => {
    const src = read("lib/relay-inbound.ts");
    expect(src).toMatch(/findFirst\(\{\s*where:\s*\{\s*relayToken:/);
  });
  it("relay token is crypto-random (not Math.random)", () => {
    const src = read("lib/relay.ts");
    expect(src).toMatch(/crypto\.randomBytes/);
    expect(src).not.toMatch(/Math\.random/);
  });
  it("every outbound relay send is consent-gated by canRelaySend", () => {
    const src = read("lib/relay-send.ts");
    expect(src).toMatch(/canRelaySend\(neg\)/);
  });
  it("relayDecision NEVER returns an automatic accept (human-in-the-loop)", () => {
    const src = read("lib/relay.ts");
    // The only "accept" handling routes to needs_approval, never auto-act.
    expect(src).toMatch(/"accept"[\s\S]*?needs_approval/);
  });

  it("the relay status page is flag-gated + owner-scoped + shows the full thread", () => {
    const src = read("app/onderhandel/[billId]/relay/page.tsx");
    expect(src).toMatch(/isEnabled\(["']RELAY_ENABLED["']\)/);
    expect(src).toMatch(/notFound\(\)/);
    expect(src).toMatch(/findFirst\(\{\s*[\s\S]*?userId\b/); // owner-scoped
    expect(src).toMatch(/RelayControls/); // accept/continue/stop + pause
    expect(src).toMatch(/rounds\.map/); // every round rendered
    expect(src).toMatch(/fmtTs/); // timestamps in the thread
  });

  it("relay-approve accept NEVER marks a saving verified (proof-path only)", () => {
    const src = read("app/api/negotiations/[id]/relay-approve/route.ts");
    expect(src).not.toMatch(/actualSavingsCents/);
    expect(src).not.toMatch(/proofVerifiedAt/);
  });

  it("the consent-prompt entrypoint (email page) is flag-gated too", () => {
    const src = read("app/onderhandel/email/page.tsx");
    expect(src).toMatch(/isEnabled\(["']RELAY_ENABLED["']\)/);
    expect(src).toMatch(/RelayConsentPrompt/);
  });

  it("FEATURE_RELAY_ENABLED stays OFF by default (owner flips it post-review)", () => {
    expect(FLAG_DEFAULTS.RELAY_ENABLED).toBe(false);
  });
});
