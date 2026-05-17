import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyTwilioSignature, verify360dialogSecret, parseTwilioMessage } from "../../lib/whatsapp";

function twilioSign(url: string, params: Record<string, string>, token: string): string {
  const sorted = Object.keys(params).sort();
  const concat = url + sorted.map((k) => k + params[k]).join("");
  return crypto.createHmac("sha1", token).update(concat).digest("base64");
}

describe("verifyTwilioSignature", () => {
  const token = "test-twilio-token";
  const url = "https://degeldheld.com/api/inbound/whatsapp";
  const params = { From: "whatsapp:+31612345678", To: "whatsapp:+31698765432", Body: "Hallo" };

  it("accepts correct signature", () => {
    const sig = twilioSign(url, params, token);
    expect(verifyTwilioSignature({ url, params, signature: sig, authToken: token })).toBe(true);
  });

  it("rejects wrong signature", () => {
    expect(verifyTwilioSignature({ url, params, signature: "deadbeef", authToken: token })).toBe(false);
  });

  it("rejects empty signature/token", () => {
    expect(verifyTwilioSignature({ url, params, signature: null, authToken: token })).toBe(false);
    expect(verifyTwilioSignature({ url, params, signature: "x", authToken: "" })).toBe(false);
  });

  it("signature changes when body changes", () => {
    const sig = twilioSign(url, params, token);
    const tampered = { ...params, Body: "Different" };
    expect(verifyTwilioSignature({ url, params: tampered, signature: sig, authToken: token })).toBe(false);
  });
});

describe("verify360dialogSecret", () => {
  it("matches shared secret", () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "abc-123";
    expect(verify360dialogSecret("abc-123")).toBe(true);
  });
  it("rejects mismatch", () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "abc-123";
    expect(verify360dialogSecret("xyz")).toBe(false);
  });
  it("rejects null", () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "abc-123";
    expect(verify360dialogSecret(null)).toBe(false);
  });
});

describe("parseTwilioMessage", () => {
  it("strips 'whatsapp:' prefix from numbers", () => {
    const m = parseTwilioMessage({ From: "whatsapp:+31612345678", To: "whatsapp:+31698765432", Body: "hi" });
    expect(m?.fromNumber).toBe("+31612345678");
    expect(m?.toNumber).toBe("+31698765432");
  });
  it("returns null when from missing", () => {
    expect(parseTwilioMessage({ Body: "hi" })).toBeNull();
  });
  it("includes media url when present", () => {
    const m = parseTwilioMessage({ From: "whatsapp:+31", To: "whatsapp:+32", Body: "", MediaUrl0: "https://x/m" });
    expect(m?.mediaUrl).toBe("https://x/m");
  });
});
