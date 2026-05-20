import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Webhook } from "svix";
import { verifyResendWebhook } from "@/lib/inbound-verify";

/**
 * Real Svix signatures — Resend signs inbound webhooks via Svix, not a bare
 * hex HMAC. We sign with the svix lib and assert our helper accepts a valid
 * signature and rejects everything else.
 */
const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
});

// A base64 secret (svix decodes the part after the whsec_ prefix).
const SECRET = "whsec_" + Buffer.from("super-secret-signing-key-bytes!!").toString("base64");

function sign(secret: string, body: string): Headers {
  const id = "msg_2abc";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // svix .sign expects a Date for the timestamp arg
  const signature = new Webhook(secret).sign(id, new Date(Number(timestamp) * 1000), body);
  return new Headers({
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  });
}

describe("v20→inbound-fix: Svix webhook verification", () => {
  const body = JSON.stringify({ type: "email.received", data: { email_id: "x", from: "a@b.nl" } });

  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
  });

  it("accepts a correctly Svix-signed payload", () => {
    expect(verifyResendWebhook(body, sign(SECRET, body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const headers = sign(SECRET, body);
    expect(verifyResendWebhook(body + "x", headers)).toBe(false);
  });

  it("rejects missing svix headers", () => {
    expect(verifyResendWebhook(body, new Headers())).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const other = "whsec_" + Buffer.from("a-totally-different-key-32bytes!!").toString("base64");
    expect(verifyResendWebhook(body, sign(other, body))).toBe(false);
  });

  it("fail-closed: rejects everything when RESEND_WEBHOOK_SECRET is unset", () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect(verifyResendWebhook(body, sign(SECRET, body))).toBe(false);
  });
});
