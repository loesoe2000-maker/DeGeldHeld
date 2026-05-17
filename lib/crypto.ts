/**
 * lib/crypto.ts — AES-256-GCM helpers for at-rest token encryption.
 *
 * Key source: TOKEN_ENC_KEY env (hex-encoded 32 bytes recommended).
 * Falls back to deriving from NEXTAUTH_SECRET when not set, so dev/test
 * still work but production should always set TOKEN_ENC_KEY explicitly.
 */

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY ?? process.env.NEXTAUTH_SECRET ?? "dgh-dev-key-fallback-2026";
  // Derive a stable 32-byte key from whatever we have.
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv).base64(tag).base64(ciphertext)
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(blob: string): string {
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivB64, tagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
