/**
 * lib/crypto.ts — AES-256-GCM at-rest token encryption with key rotation.
 *
 * Key precedence:
 *   1. TOKEN_ENC_KEY_PRIMARY (or legacy TOKEN_ENC_KEY)  — new encrypts
 *   2. TOKEN_ENC_KEY_FALLBACK                          — decrypt-only
 *   3. NEXTAUTH_SECRET                                 — dev fallback only
 *
 * Ciphertext format: `v1:<keyId>:base64(iv).base64(tag).base64(ct)`
 *   - keyId is "p" (primary) or "f" (fallback). Records always carry "p"
 *     after a successful rotation. To rotate keys without data-loss:
 *
 *     1. Generate new key (`openssl rand -hex 32`).
 *     2. Set current key as TOKEN_ENC_KEY_FALLBACK, new key as PRIMARY.
 *     3. Redeploy Vercel.
 *     4. Run `npm run rotate-keys` → re-encrypts all BankConnection
 *        records under the new primary.
 *     5. Remove TOKEN_ENC_KEY_FALLBACK; redeploy.
 *
 * Legacy format (v8, no version prefix): plain `iv.tag.ct` triplet —
 * still decryptable with the primary key.
 */

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";

export type KeyId = "p" | "f";

function deriveKey(raw: string): Buffer {
  return crypto.createHash("sha256").update(raw).digest();
}

function primaryRaw(): string {
  return (
    process.env.TOKEN_ENC_KEY_PRIMARY ??
    process.env.TOKEN_ENC_KEY ??
    process.env.NEXTAUTH_SECRET ??
    "dgh-dev-key-fallback-2026"
  );
}

function fallbackRaw(): string | null {
  return process.env.TOKEN_ENC_KEY_FALLBACK ?? null;
}

export function getKey(id: KeyId): Buffer | null {
  if (id === "p") return deriveKey(primaryRaw());
  const fb = fallbackRaw();
  return fb ? deriveKey(fb) : null;
}

/** True when a fallback key is configured (i.e. a rotation is in progress). */
export function hasFallbackKey(): boolean {
  return fallbackRaw() !== null;
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey("p")!, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:p:${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

function decryptWithKey(payload: string, key: Buffer): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivB64, tagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function decryptToken(blob: string): string {
  if (blob.startsWith(`${VERSION}:`)) {
    const idx2 = blob.indexOf(":", VERSION.length + 1);
    if (idx2 < 0) throw new Error("Malformed versioned blob");
    const keyId = blob.slice(VERSION.length + 1, idx2);
    const payload = blob.slice(idx2 + 1);
    if (keyId !== "p" && keyId !== "f") throw new Error("Unknown keyId");
    const primary = getKey("p")!;
    const fallback = getKey("f");
    // Try the indicated key first, then the other — covers swap-day where
    // a record encrypted as "p" actually used what's now the fallback key.
    const order = keyId === "p" ? [primary, fallback] : [fallback, primary];
    let lastErr: unknown;
    for (const k of order) {
      if (!k) continue;
      try {
        return decryptWithKey(payload, k);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("Decrypt failed");
  }
  // Legacy v8 unversioned format
  return decryptWithKey(blob, getKey("p")!);
}

/** True when a blob should be re-encrypted (legacy or fallback-keyed). */
export function isLegacyOrFallbackEncrypted(blob: string): boolean {
  if (!blob.startsWith(`${VERSION}:`)) return true; // legacy
  return blob.startsWith(`${VERSION}:f:`);
}
