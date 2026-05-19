import { describe, it, expect } from "vitest";
import {
  generateAnonSessionId,
  isValidAnonSessionId,
  ANON_COOKIE_NAME,
  ANON_COOKIE_MAX_AGE_SECONDS,
  ANON_COOKIE_OPTIONS,
} from "@/lib/anon-session";

describe("anon-session helpers (v15 DEEL 1)", () => {
  it("generates UUID v4-shaped ids", () => {
    const id = generateAnonSessionId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("ids are unique per call", () => {
    const a = generateAnonSessionId();
    const b = generateAnonSessionId();
    expect(a).not.toBe(b);
  });

  it("isValidAnonSessionId accepts generated ids", () => {
    expect(isValidAnonSessionId(generateAnonSessionId())).toBe(true);
  });

  it("isValidAnonSessionId rejects forged cookie shapes", () => {
    expect(isValidAnonSessionId(null)).toBe(false);
    expect(isValidAnonSessionId("")).toBe(false);
    expect(isValidAnonSessionId("not-a-uuid")).toBe(false);
    expect(isValidAnonSessionId("' OR 1=1 --")).toBe(false);
    expect(isValidAnonSessionId("12345678901234567890")).toBe(false);
  });

  it("cookie attributes match the documented contract", () => {
    expect(ANON_COOKIE_NAME).toBe("dgh_anon_session");
    expect(ANON_COOKIE_MAX_AGE_SECONDS).toBe(24 * 60 * 60);
    expect(ANON_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(ANON_COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(ANON_COOKIE_OPTIONS.path).toBe("/");
  });
});

describe("anon upload route — source-level contract", () => {
  it("upload route handles isAnonymous path + sets cookie", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").resolve(__dirname, "../app/api/bills/upload/route.ts"),
      "utf8",
    );
    // The route must recognise anonymous flow + mint the cookie.
    expect(src).toMatch(/isAnonymous/);
    expect(src).toMatch(/ANON_COOKIE_NAME/);
    expect(src).toMatch(/anonymousSessionId/);
    expect(src).toMatch(/verifyTurnstileToken/);
  });

  it("anonymous IP rate-limit is 3/hour (per sprint)", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").resolve(__dirname, "../app/api/bills/upload/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/upload-anon:/);
    expect(src).toMatch(/max:\s*3/);
  });
});
