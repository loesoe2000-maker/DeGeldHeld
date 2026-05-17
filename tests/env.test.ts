import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { envHealth, loadEnv } from "../lib/env";

const KEYS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "GROQ_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

describe("env", () => {
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("parses successfully when all required vars are set", () => {
    const env = loadEnv();
    expect(env.DATABASE_URL).toBeTruthy();
    expect(env.NEXTAUTH_SECRET.length).toBeGreaterThanOrEqual(16);
  });

  it("envHealth.ok=true when all set", () => {
    expect(envHealth().ok).toBe(true);
  });

  it("envHealth.ok=false when DATABASE_URL missing", () => {
    delete process.env.DATABASE_URL;
    const h = envHealth();
    expect(h.ok).toBe(false);
    expect(h.missing).toContain("DATABASE_URL");
  });

  it("loadEnv throws when DATABASE_URL missing in strict mode", () => {
    delete process.env.DATABASE_URL;
    expect(() => loadEnv(true)).toThrow(/DATABASE_URL/);
  });

  it("envHealth lists multiple missing vars", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const h = envHealth();
    expect(h.missing).toContain("GROQ_API_KEY");
    expect(h.missing).toContain("STRIPE_SECRET_KEY");
  });

  it("rejects malformed DATABASE_URL", () => {
    process.env.DATABASE_URL = "not-a-url";
    expect(() => loadEnv(true)).toThrow();
  });

  it("rejects too-short NEXTAUTH_SECRET", () => {
    process.env.NEXTAUTH_SECRET = "short";
    expect(() => loadEnv(true)).toThrow(/NEXTAUTH_SECRET/);
  });

  it("provides sensible defaults for optional fields", () => {
    delete process.env.GROQ_VISION_MODEL;
    const env = loadEnv();
    // v7 free-tier vision-capable model: scout
    expect(env.GROQ_VISION_MODEL).toMatch(/scout|vision/);
  });
});
