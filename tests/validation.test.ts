import { describe, it, expect } from "vitest";
import { emailSchema, isValidEmail, waitlistSchema } from "../lib/validation";
import {
  checkoutSchema,
  negotiationSentSchema,
  negotiationOutcomeSchema,
  negotiationRoundSchema,
  providerDiscoverSchema,
  providerCandidatePatchSchema,
  firstIssueMessage,
} from "../lib/schemas";

describe("validation/emailSchema", () => {
  it("accepts valid emails", () => {
    expect(emailSchema.parse("a@b.nl")).toBe("a@b.nl");
    expect(emailSchema.parse("foo.bar@example.co.uk")).toBe("foo.bar@example.co.uk");
  });

  it("normalizes to lowercase", () => {
    expect(emailSchema.parse("FOO@BAR.NL")).toBe("foo@bar.nl");
  });

  it("trims whitespace", () => {
    expect(emailSchema.parse("  a@b.nl  ")).toBe("a@b.nl");
  });

  it("rejects empty string", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("rejects strings without @", () => {
    expect(emailSchema.safeParse("notanemail").success).toBe(false);
  });

  it("rejects very long emails", () => {
    const huge = "a".repeat(255) + "@b.nl";
    expect(emailSchema.safeParse(huge).success).toBe(false);
  });
});

describe("validation/isValidEmail", () => {
  it("type-narrows correctly", () => {
    expect(isValidEmail("a@b.nl")).toBe(true);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });
});

describe("validation/waitlistSchema", () => {
  it("accepts minimal payload", () => {
    const p = waitlistSchema.parse({ email: "a@b.nl" });
    expect(p.email).toBe("a@b.nl");
    expect(p.source).toBeUndefined();
  });

  it("accepts source", () => {
    const p = waitlistSchema.parse({ email: "a@b.nl", source: "hero" });
    expect(p.source).toBe("hero");
  });

  it("rejects too-long source", () => {
    const longSource = "x".repeat(65);
    expect(waitlistSchema.safeParse({ email: "a@b.nl", source: longSource }).success).toBe(false);
  });
});

describe("lib/schemas — valid + invalid case per mutation endpoint", () => {
  it("checkoutSchema", () => {
    expect(checkoutSchema.safeParse({ negotiationId: "abc" }).success).toBe(true);
    expect(checkoutSchema.safeParse({}).success).toBe(false);
  });

  it("negotiationSentSchema — at least one id required", () => {
    expect(negotiationSentSchema.safeParse({ billId: "b1" }).success).toBe(true);
    expect(negotiationSentSchema.safeParse({ negotiationId: "n1" }).success).toBe(true);
    expect(negotiationSentSchema.safeParse({}).success).toBe(false);
  });

  it("negotiationOutcomeSchema", () => {
    expect(
      negotiationOutcomeSchema.safeParse({
        negotiationId: "n1",
        outcome: "SUCCESS_SAVED",
        actualSavingsCents: 1200,
      }).success,
    ).toBe(true);
    expect(
      negotiationOutcomeSchema.safeParse({ negotiationId: "n1", outcome: "WAT" }).success,
    ).toBe(false);
    expect(
      negotiationOutcomeSchema.safeParse({
        negotiationId: "n1",
        outcome: "SUCCESS_SAVED",
        actualSavingsCents: -1,
      }).success,
    ).toBe(false);
  });

  it("negotiationRoundSchema", () => {
    expect(negotiationRoundSchema.safeParse({ negotiationId: "n1" }).success).toBe(true);
    expect(
      negotiationRoundSchema.safeParse({
        negotiationId: "n1",
        providerResponse: "iets",
      }).success,
    ).toBe(true);
    expect(negotiationRoundSchema.safeParse({}).success).toBe(false);
    expect(
      negotiationRoundSchema.safeParse({
        negotiationId: "n1",
        providerResponse: "x".repeat(20_001),
      }).success,
    ).toBe(false);
  });

  it("providerDiscoverSchema upper-cases the country code", () => {
    const r = providerDiscoverSchema.safeParse({ name: "ZiggoX", country: "nl" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.country).toBe("NL");
    expect(providerDiscoverSchema.safeParse({ name: "x", country: "NL" }).success).toBe(false);
  });

  it("providerCandidatePatchSchema", () => {
    expect(providerCandidatePatchSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
    expect(providerCandidatePatchSchema.safeParse({ status: "MAYBE" }).success).toBe(false);
  });

  it("firstIssueMessage returns a non-empty string on failure", () => {
    const r = checkoutSchema.safeParse({});
    if (!r.success) {
      const msg = firstIssueMessage(r.error);
      expect(msg.length).toBeGreaterThan(0);
    } else {
      throw new Error("expected validation failure");
    }
  });
});
