import { describe, it, expect } from "vitest";
import { emailSchema, isValidEmail, waitlistSchema } from "../lib/validation";

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
