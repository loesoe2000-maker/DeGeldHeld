import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { relayProviderEmail, relayProviderRegistry } from "@/lib/relay-providers";

/**
 * v25 DEEL 1 — sourced provider email registry. The defining test is the
 * anti-hallucination one: EVERY entry that carries an email must also name a
 * `// bron: <URL>` on the same line. A future entry added without a bron fails
 * the build → no unsourced address can sneak in.
 */
describe("relay-providers: lookup", () => {
  it("case-insensitive hit returns the verified email", () => {
    expect(relayProviderEmail("Vattenfall")).toBe("vattenfall@vattenfall.nl");
    expect(relayProviderEmail("vattenfall")).toBe("vattenfall@vattenfall.nl");
    expect(relayProviderEmail("  GREENCHOICE  ")).toBe("vragen@greenchoice.nl");
  });

  it("unknown provider → null (consent UI falls back to manual entry)", () => {
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

describe("relay-providers: anti-hallucination — every entry is sourced", () => {
  const src = readFileSync(
    resolve(__dirname, "..", "lib/relay-providers.ts"),
    "utf8",
  );

  it("every line that defines an email entry carries a // bron: <URL>", () => {
    // Lines inside the registry that contain an `email:` field.
    const entryLines = src
      .split("\n")
      .filter((l) => /email:\s*"/.test(l) && !l.trimStart().startsWith("//"));
    expect(entryLines.length).toBeGreaterThan(0);
    for (const line of entryLines) {
      expect(line).toMatch(/\/\/\s*bron:\s*https?:\/\/\S+/);
    }
  });

  it("the number of // bron: comments matches the number of email entries", () => {
    const emailEntries = (src.match(/email:\s*"/g) ?? []).length;
    const bronComments = (src.match(/\/\/\s*bron:\s*https?:\/\//g) ?? []).length;
    expect(bronComments).toBe(emailEntries);
  });
});
