import { describe, it, expect } from "vitest";
import { parseProofPayload, extractProofToken } from "@/lib/proof-inbound";

// Signature verification moved to lib/inbound-verify.ts (Svix) — see
// tests/inbound-handler.test.ts. This file now only covers the parser.

describe("proof-inbound / parseProofPayload", () => {
  it("returns null when from is missing", () => {
    expect(parseProofPayload({ subject: "x" })).toBeNull();
    expect(parseProofPayload(null)).toBeNull();
  });

  it("normalizes from to lowercase", () => {
    const p = parseProofPayload({ from: " USER@FOO.NL ", subject: "x", text: "y" });
    expect(p!.from).toBe("user@foo.nl");
  });

  it("pulls In-Reply-To from headers", () => {
    const p = parseProofPayload({
      from: "x@y.nl",
      subject: "Re: korting",
      text: "z",
      headers: { "In-Reply-To": "<abc@degeldheld.com>" },
    });
    expect(p!.inReplyTo).toBe("<abc@degeldheld.com>");
  });
});

describe("proof-inbound / extractProofToken", () => {
  it("extracts [PROOF-<id>] from subject", () => {
    expect(extractProofToken("Re: factuur [PROOF-clxyz1234567890abcdef]")).toBe(
      "clxyz1234567890abcdef",
    );
  });
  it("returns null when token is absent", () => {
    expect(extractProofToken("Re: factuur")).toBeNull();
  });
  it("rejects too-short tokens", () => {
    expect(extractProofToken("[PROOF-short]")).toBeNull();
  });
});
