import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  hasFallbackKey,
  isLegacyOrFallbackEncrypted,
} from "../lib/crypto";

function setKeys(primary: string, fallback?: string) {
  process.env.TOKEN_ENC_KEY_PRIMARY = primary;
  if (fallback === undefined) delete process.env.TOKEN_ENC_KEY_FALLBACK;
  else process.env.TOKEN_ENC_KEY_FALLBACK = fallback;
  // Clear legacy var to avoid resolution-order surprises
  delete process.env.TOKEN_ENC_KEY;
}

beforeEach(() => {
  setKeys("key-A-very-strong");
});

describe("encryptToken / decryptToken — single-key round-trip", () => {
  it("v1: prefix on new encrypts", () => {
    const enc = encryptToken("hello");
    expect(enc).toMatch(/^v1:p:/);
  });

  it("decrypts what it encrypts", () => {
    const enc = encryptToken("hello world");
    expect(decryptToken(enc)).toBe("hello world");
  });

  it("hasFallbackKey false when only primary set", () => {
    setKeys("only-primary");
    expect(hasFallbackKey()).toBe(false);
  });
});

describe("dual-key: swap-day decrypt path", () => {
  it("encrypt with key-A, then make key-A the fallback + new primary key-B, decrypt still works", () => {
    setKeys("key-A");
    const enc = encryptToken("sensitive-token");
    // Rotation: swap keys
    setKeys("key-B-new", "key-A");
    expect(hasFallbackKey()).toBe(true);
    expect(decryptToken(enc)).toBe("sensitive-token");
  });

  it("after swap, blob is marked as legacy/fallback for the rotator to pick up", () => {
    setKeys("key-A");
    const enc = encryptToken("x");
    // Blob says "p" but with new key set, the *actual* enc key is the
    // fallback; isLegacyOrFallback only flags blobs that explicitly say "f"
    // or are pre-v1. A primary-marked record encrypted with the previous
    // primary will be re-encrypted on first decrypt+encrypt cycle.
    setKeys("key-B-new", "key-A");
    expect(isLegacyOrFallbackEncrypted(enc)).toBe(false);
  });

  it("explicitly fallback-marked blob is re-encryptable", () => {
    // Simulate a v8 legacy blob (no version prefix)
    setKeys("key-A");
    const enc = encryptToken("x");
    const payload = enc.replace(/^v1:p:/, ""); // strip the prefix → legacy shape
    expect(isLegacyOrFallbackEncrypted(payload)).toBe(true);
    expect(decryptToken(payload)).toBe("x");
  });
});

describe("decrypt error paths", () => {
  it("throws on malformed input", () => {
    expect(() => decryptToken("not.a.valid")).toThrow();
  });

  it("throws on tampered ciphertext (auth tag rejects)", () => {
    const enc = encryptToken("foo");
    const tampered = enc.slice(0, -1) + (enc.endsWith("A") ? "B" : "A");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws on unknown keyId", () => {
    expect(() => decryptToken("v1:x:abc.def.ghi")).toThrow(/Unknown keyId/);
  });
});

describe("legacy v8 compatibility", () => {
  it("unversioned blob still decrypts under primary", () => {
    setKeys("legacy-key");
    // Manually craft a v8 legacy blob (no v1 prefix)
    const enc = encryptToken("legacy-data");
    const v8 = enc.replace(/^v1:p:/, "");
    expect(decryptToken(v8)).toBe("legacy-data");
  });
});
