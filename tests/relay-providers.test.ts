import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  relayProviderEmail,
  relayProviderChannel,
  relayNoEmailNote,
  relayProviderRegistry,
  relayNoEmailRegistry,
} from "@/lib/relay-providers";

/**
 * v25/v26 — sourced provider email registry + no-email channel map. The
 * defining test is the anti-hallucination one: EVERY entry (email OR no-email)
 * must name a `// bron: <URL>` on the same line. An entry added without a bron
 * fails the build → no unsourced claim can sneak in.
 */
describe("relay-providers: lookup", () => {
  it("case-insensitive hit returns the verified email", () => {
    expect(relayProviderEmail("Vattenfall")).toBe("vattenfall@vattenfall.nl");
    expect(relayProviderEmail("vattenfall")).toBe("vattenfall@vattenfall.nl");
    expect(relayProviderEmail("  GREENCHOICE  ")).toBe("vragen@greenchoice.nl");
  });

  it("unknown / no-email provider → null email (UI falls back to manual entry)", () => {
    expect(relayProviderEmail("KPN")).toBeNull();
    expect(relayProviderEmail("Onbekend BV")).toBeNull();
    expect(relayProviderEmail("")).toBeNull();
  });

  it("every registry email is a syntactically valid address", () => {
    for (const e of relayProviderRegistry()) {
      expect(e.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    }
  });
});

describe("relay-providers: channel map", () => {
  it("verified address → 'email'", () => {
    expect(relayProviderChannel("Vattenfall")).toBe("email");
    expect(relayProviderChannel("freedom internet")).toBe("email");
  });

  it("the big telecom providers are marked 'no-email' (honest expectation)", () => {
    for (const p of ["KPN", "Vodafone", "Odido", "Ziggo", "Tele2", "Simyo"]) {
      expect(relayProviderChannel(p)).toBe("no-email");
      expect(relayNoEmailNote(p)).toMatch(/e-mail/i);
    }
  });

  it("an unresearched/unknown provider → 'unknown'", () => {
    expect(relayProviderChannel("Onbekend BV")).toBe("unknown");
    expect(relayProviderChannel("")).toBe("unknown");
    expect(relayNoEmailNote("Onbekend BV")).toBeNull();
  });

  it("a provider is never in both registries", () => {
    const emails = new Set(relayProviderRegistry().map((e) => e.provider.toLowerCase()));
    for (const n of relayNoEmailRegistry()) {
      expect(emails.has(n.provider.toLowerCase())).toBe(false);
    }
  });
});

describe("relay-providers: anti-hallucination — every entry is sourced", () => {
  const src = readFileSync(resolve(__dirname, "..", "lib/relay-providers.ts"), "utf8");

  function entryLines() {
    return src
      .split("\n")
      .filter((l) => /\{\s*provider:\s*"/.test(l) && !l.trimStart().startsWith("//"));
  }

  it("every provider entry (email AND no-email) carries a // bron: <URL>", () => {
    const lines = entryLines();
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/\/\/\s*bron:\s*https?:\/\/\S+/);
    }
  });

  it("the number of // bron: comments matches the number of entries", () => {
    const entries = entryLines().length;
    const bron = (src.match(/\/\/\s*bron:\s*https?:\/\//g) ?? []).length;
    expect(bron).toBe(entries);
  });
});
