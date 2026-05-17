import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "../../lib/crypto";

describe("lib/crypto: AES-256-GCM round-trip", () => {
  it("encrypts and decrypts a short string", () => {
    const enc = encryptToken("hello world");
    expect(enc).not.toBe("hello world");
    expect(decryptToken(enc)).toBe("hello world");
  });

  it("ciphertext varies between calls (random IV)", () => {
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-input");
    expect(decryptToken(b)).toBe("same-input");
  });

  it("handles realistic-length OAuth tokens (~120 chars)", () => {
    const token = "a".repeat(40) + "_" + "b".repeat(80);
    const enc = encryptToken(token);
    expect(decryptToken(enc)).toBe(token);
  });

  it("decrypt throws on malformed input", () => {
    expect(() => decryptToken("not.a.valid.format")).toThrow();
    expect(() => decryptToken("bad-format-no-dots")).toThrow();
  });

  it("decrypt throws on tampered ciphertext (auth tag rejects)", () => {
    const enc = encryptToken("hello");
    const [iv, tag, ct] = enc.split(".");
    const tampered = `${iv}.${tag}.${ct.replace(/.$/, "X")}`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});
