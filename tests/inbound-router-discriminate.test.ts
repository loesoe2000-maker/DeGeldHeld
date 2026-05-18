import { describe, it, expect } from "vitest";
import { discriminate } from "@/lib/auto-pingpong";
import {
  extractProofSubjectToken,
  extractNegotiationSubjectToken,
} from "@/lib/email-thread";

describe("subject token extractors (v12 DEEL 1)", () => {
  it("[PROOF-<id>] is extracted", () => {
    expect(extractProofSubjectToken("Re: factuur [PROOF-clxyz1234567890abcdef]")).toBe(
      "clxyz1234567890abcdef",
    );
  });
  it("[NEGOTIATION-<id>] is extracted", () => {
    expect(
      extractNegotiationSubjectToken("Antwoord [NEGOTIATION-clabc1234567890abcdef]"),
    ).toBe("clabc1234567890abcdef");
  });
  it("subject without token returns null for both", () => {
    expect(extractProofSubjectToken("Re: factuur")).toBeNull();
    expect(extractNegotiationSubjectToken("Re: factuur")).toBeNull();
  });
  it("too-short tokens are rejected (collision with raw text)", () => {
    expect(extractProofSubjectToken("[PROOF-short]")).toBeNull();
    expect(extractNegotiationSubjectToken("[NEGOTIATION-short]")).toBeNull();
  });
});

describe("discriminate() routing decision", () => {
  it("PROOF subject → proof intent", () => {
    const r = discriminate({
      subject: "Re: factuur [PROOF-clxyz1234567890abcdef]",
      inReplyTo: null,
      references: null,
    });
    expect(r.kind).toBe("proof");
    if (r.kind === "proof") expect(r.billId).toBe("clxyz1234567890abcdef");
  });

  it("NEGOTIATION subject → negotiation intent with explicit id", () => {
    const r = discriminate({
      subject: "Re: tarief [NEGOTIATION-clabc1234567890abcdef]",
      inReplyTo: null,
      references: null,
    });
    expect(r.kind).toBe("negotiation");
    if (r.kind === "negotiation") {
      expect(r.negotiationId).toBe("clabc1234567890abcdef");
      expect(r.viaThreadId).toBe(false);
    }
  });

  it("In-Reply-To with valid thread-id → negotiation intent via thread", () => {
    const r = discriminate({
      subject: "Re: tarief",
      inReplyTo: "<12345678-90ab-4cde-9012-345678901234@degeldheld.com>",
      references: null,
    });
    expect(r.kind).toBe("negotiation");
    if (r.kind === "negotiation") {
      expect(r.negotiationId).toBeNull();
      expect(r.viaThreadId).toBe(true);
    }
  });

  it("plain subject + no headers → unknown", () => {
    const r = discriminate({ subject: "Hi", inReplyTo: null, references: null });
    expect(r.kind).toBe("unknown");
  });

  it("PROOF beats NEGOTIATION when both subjects present (proof is more specific)", () => {
    // Defensive: a forwarded "[NEGOTIATION-x]" with a "[PROOF-y]"
    // wrapper goes to the proof branch — proof is the user-action
    // intent, negotiation is the provider intent.
    const r = discriminate({
      subject: "[PROOF-aaaaaaaaaaaaaaaaaaaa] [NEGOTIATION-bbbbbbbbbbbbbbbbbbbb]",
      inReplyTo: null,
      references: null,
    });
    expect(r.kind).toBe("proof");
  });

  it("foreign-domain In-Reply-To is ignored (not a degeldheld thread)", () => {
    const r = discriminate({
      subject: "Re: tarief",
      inReplyTo: "<12345678-90ab-4cde-9012-345678901234@example.com>",
      references: null,
    });
    expect(r.kind).toBe("unknown");
  });
});
