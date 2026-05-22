import { describe, it, expect } from "vitest";
import {
  canRelaySend,
  relayDecision,
  generateRelayToken,
  relayReplyTo,
  extractRelayToken,
  providerAsksAccountHolder,
  MAX_AUTO_ROUNDS,
} from "@/lib/relay";

describe("v23 GUARDRAIL 1 — consent-first send gate", () => {
  it("blocks a send without authorization", () => {
    expect(canRelaySend({ relayAuthorizedAt: null, relayState: "RELAY_ACTIVE" })).toBe(false);
  });
  it("blocks a send when not actively relaying (paused/awaiting/done)", () => {
    const at = new Date();
    expect(canRelaySend({ relayAuthorizedAt: at, relayState: "PAUSED" })).toBe(false);
    expect(canRelaySend({ relayAuthorizedAt: at, relayState: "AWAITING_APPROVAL" })).toBe(false);
    expect(canRelaySend({ relayAuthorizedAt: at, relayState: "DONE" })).toBe(false);
    expect(canRelaySend({ relayAuthorizedAt: at, relayState: null })).toBe(false);
  });
  it("allows a send only when authorized AND RELAY_ACTIVE", () => {
    expect(canRelaySend({ relayAuthorizedAt: new Date(), relayState: "RELAY_ACTIVE" })).toBe(true);
  });
});

describe("v23 relay token (anti-abuse)", () => {
  it("generates unguessable, unique, email-safe tokens", () => {
    const a = generateRelayToken();
    const b = generateRelayToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(24);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // valid in an email local-part
  });
  it("token is case-insensitive-safe (no uppercase) — email lowercases the local-part", () => {
    // Regression: mixed-case (base64url) tokens broke inbound matching because
    // mail systems lowercase the address local-part on reply. Hex tokens have
    // no uppercase, so the inbound token always matches the stored one.
    for (let i = 0; i < 20; i++) {
      const t = generateRelayToken();
      expect(t).toBe(t.toLowerCase());
      expect(t).toMatch(/^[0-9a-f]+$/);
    }
  });
  it("round-trips through the reply-to address", () => {
    const t = generateRelayToken();
    const addr = relayReplyTo(t);
    expect(addr).toContain(`onderhandel+${t}@`);
    expect(extractRelayToken([addr])).toBe(t);
  });
  it("returns null when no recipient carries a relay token", () => {
    expect(extractRelayToken(["inbox@degeldheld.com", "x@y.nl"])).toBeNull();
  });
});

describe("v23 GUARDRAIL 2 — human-in-the-loop on commitment", () => {
  const base = { providerText: "We kunnen u een kleine korting bieden.", autoRoundsUsed: 0 };

  it("routine counter → auto_counter (the automatic path)", () => {
    expect(relayDecision({ ...base, analysis: { action: "counter" } })).toEqual({ kind: "auto_counter" });
  });

  it("a concrete acceptable deal (accept) → needs_approval, NEVER auto", () => {
    const d = relayDecision({ ...base, analysis: { action: "accept" } });
    expect(d.kind).toBe("needs_approval");
    if (d.kind === "needs_approval") expect(d.reason).toBe("deal");
  });

  it("provider asks the account-holder to confirm → needs_approval", () => {
    const d = relayDecision({
      analysis: { action: "counter" },
      providerText: "Bent u de contracthouder? We hebben uw akkoord nodig.",
      autoRoundsUsed: 0,
    });
    expect(d.kind).toBe("needs_approval");
    if (d.kind === "needs_approval") expect(d.reason).toBe("provider_pushback");
  });

  it("walk_away → stop (hand back, no auto-send)", () => {
    expect(relayDecision({ ...base, analysis: { action: "walk_away" } })).toEqual({
      kind: "stop",
      reason: "walk_away",
    });
  });

  it("loop-guard: too many auto-rounds → needs_approval even for a counter", () => {
    const d = relayDecision({ ...base, analysis: { action: "counter" }, autoRoundsUsed: MAX_AUTO_ROUNDS });
    expect(d.kind).toBe("needs_approval");
    if (d.kind === "needs_approval") expect(d.reason).toBe("loop_guard");
  });

  it("escalate → noop (we never auto-escalate)", () => {
    expect(relayDecision({ ...base, analysis: { action: "escalate" } }).kind).toBe("noop");
  });

  it("relayDecision NEVER returns an automatic accept action", () => {
    for (const action of ["accept", "counter", "walk_away", "escalate"] as const) {
      const d = relayDecision({ ...base, analysis: { action } });
      expect(["auto_counter", "needs_approval", "stop", "noop"]).toContain(d.kind);
    }
  });
});

describe("v23 providerAsksAccountHolder detector", () => {
  it("catches NL + EN account-holder confirmation requests", () => {
    expect(providerAsksAccountHolder("Kunt u zich legitimeren als rekeninghouder?")).toBe(true);
    expect(providerAsksAccountHolder("We need your written consent")).toBe(true);
    expect(providerAsksAccountHolder("Bedankt, we verlagen uw tarief naar €20.")).toBe(false);
  });
});
