import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signOutcomeToken, verifyOutcomeToken } from "@/lib/outcome_token";

describe("outcome_token — HMAC sign + verify", () => {
  const prevSecret = process.env.OUTCOME_TOKEN_SECRET;
  beforeAll(() => {
    process.env.OUTCOME_TOKEN_SECRET = "test-secret-32-bytes-or-more-pls-ok";
  });
  afterAll(() => {
    if (prevSecret === undefined) delete process.env.OUTCOME_TOKEN_SECRET;
    else process.env.OUTCOME_TOKEN_SECRET = prevSecret;
  });

  it("roundtrips a valid billId", () => {
    const token = signOutcomeToken("bill_abc");
    const v = verifyOutcomeToken(token);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.billId).toBe("bill_abc");
  });

  it("rejects empty token", () => {
    expect(verifyOutcomeToken("").ok).toBe(false);
  });

  it("rejects malformed token", () => {
    const r = verifyOutcomeToken("not.a.token.too.many");
    expect(r.ok).toBe(false);
  });

  it("rejects tampered billId", () => {
    const token = signOutcomeToken("bill_abc");
    const parts = token.split(".");
    parts[0] = "bill_xyz";
    const tampered = parts.join(".");
    expect(verifyOutcomeToken(tampered).ok).toBe(false);
  });

  it("rejects expired token", () => {
    const past = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago
    const token = signOutcomeToken("bill_abc", past);
    const r = verifyOutcomeToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("rejects token signed with different secret", () => {
    const token = signOutcomeToken("bill_abc");
    process.env.OUTCOME_TOKEN_SECRET = "different-secret-32-bytes-or-more-ok";
    const r = verifyOutcomeToken(token);
    expect(r.ok).toBe(false);
    process.env.OUTCOME_TOKEN_SECRET = "test-secret-32-bytes-or-more-pls-ok";
  });

  it("token contains no querystring-illegal chars", () => {
    const token = signOutcomeToken("bill_xyz");
    // base64url uses only A-Z a-z 0-9 - _ and dots as separator
    expect(token).toMatch(/^[A-Za-z0-9_\-.]+$/);
  });
});
