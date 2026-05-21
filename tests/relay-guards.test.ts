import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    expect(src).toMatch(/findUnique\(\{\s*where:\s*\{\s*relayToken:/);
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
});
