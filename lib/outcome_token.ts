/**
 * HMAC-signed outcome tokens.
 *
 * The follow-up email links to /onderhandel/[billId]/uitkomst?token=<hmac>
 * so the user can record the outcome without needing to be logged in.
 * The token binds billId + a 30-day expiry to a server-side secret.
 */

import crypto from "crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const s = process.env.OUTCOME_TOKEN_SECRET ?? process.env.CRON_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("OUTCOME_TOKEN_SECRET / CRON_SECRET / NEXTAUTH_SECRET must be set");
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signOutcomeToken(billId: string, now: number = Date.now()): string {
  const exp = now + TOKEN_TTL_MS;
  const payload = `${billId}.${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

export type VerifyResult =
  | { ok: true; billId: string; exp: number }
  | { ok: false; reason: string };

export function verifyOutcomeToken(token: string, now: number = Date.now()): VerifyResult {
  if (!token) return { ok: false, reason: "empty" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [billId, expStr, sigB64] = parts;
  const exp = Number(expStr);
  if (!Number.isInteger(exp)) return { ok: false, reason: "bad-exp" };
  if (now > exp) return { ok: false, reason: "expired" };

  const payload = `${billId}.${exp}`;
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(payload).digest();
  const givenSig = fromB64url(sigB64);
  if (expectedSig.length !== givenSig.length) {
    return { ok: false, reason: "bad-sig" };
  }
  if (!crypto.timingSafeEqual(expectedSig, givenSig)) {
    return { ok: false, reason: "bad-sig" };
  }
  return { ok: true, billId, exp };
}
