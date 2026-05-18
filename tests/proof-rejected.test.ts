import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifyProofSignature,
  parseProofPayload,
  extractProofToken,
} from "@/lib/proof-inbound";

describe("proof-inbound / HMAC signature verification", () => {
  const SECRET = "proof-test-secret-32-bytes-padded-xxxx";

  it("rejects unsigned bodies", () => {
    process.env.RESEND_PROOF_WEBHOOK_SECRET = SECRET;
    expect(verifyProofSignature("{}", null)).toBe(false);
    expect(verifyProofSignature("{}", "")).toBe(false);
  });

  it("rejects when secret env is missing", () => {
    delete process.env.RESEND_PROOF_WEBHOOK_SECRET;
    expect(verifyProofSignature("{}", "abcd")).toBe(false);
  });

  it("accepts correctly-signed body", () => {
    process.env.RESEND_PROOF_WEBHOOK_SECRET = SECRET;
    const body = JSON.stringify({ from: "x@y.nl" });
    const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyProofSignature(body, sig)).toBe(true);
  });

  it("rejects forged signature with right length", () => {
    process.env.RESEND_PROOF_WEBHOOK_SECRET = SECRET;
    expect(verifyProofSignature("{}", "00".repeat(32))).toBe(false);
  });
});

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
