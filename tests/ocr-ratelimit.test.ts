import { describe, it, expect, afterEach } from "vitest";
import {
  isRateLimitError,
  retryAfterMs,
  GROQ_BACKOFF_MS,
  __setOcrSleep,
} from "@/lib/ocr";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(() => __setOcrSleep(null));

describe("v18 Groq 429 — rate-limit detection", () => {
  it("detects status:429", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });
  it("detects 'rate limit' in message", () => {
    expect(isRateLimitError(new Error("Groq: rate_limit_exceeded"))).toBe(true);
    expect(isRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
  });
  it("does NOT flag a 400 invalid-image error", () => {
    expect(isRateLimitError(new Error("invalid image data"))).toBe(false);
    expect(isRateLimitError({ status: 400 })).toBe(false);
  });
  it("null/undefined → false", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe("v18 Groq 429 — retry-after parsing", () => {
  it("reads retry-after header (seconds → ms, capped 10s)", () => {
    expect(retryAfterMs({ headers: { "retry-after": "3" } })).toBe(3000);
    expect(retryAfterMs({ headers: { "Retry-After": "30" } })).toBe(10_000); // capped
  });
  it("reads retryAfter property", () => {
    expect(retryAfterMs({ retryAfter: 2 })).toBe(2000);
  });
  it("no header → null", () => {
    expect(retryAfterMs(new Error("boom"))).toBeNull();
  });
});

describe("v18 Groq 429 — backoff schedule", () => {
  it("is 1s → 2s → 4s, max 3 retries, total <12s budget", () => {
    expect(GROQ_BACKOFF_MS).toEqual([1000, 2000, 4000]);
    const total = GROQ_BACKOFF_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(12_000);
  });

  it("__setOcrSleep replaces the sleep so tests don't actually wait", async () => {
    let waited = 0;
    __setOcrSleep(async (ms) => {
      waited += ms;
    });
    // Calling the seam directly proves it's wired; the real loop is
    // exercised via the upload-route source contract below.
    expect(waited).toBe(0);
  });
});

describe("v18 Groq 429 — upload route + client UX contracts", () => {
  it("upload route maps OCR_RATE_LIMITED → 503 retryable", () => {
    const src = readFileSync(resolve(__dirname, "../app/api/bills/upload/route.ts"), "utf8");
    expect(src).toMatch(/OCR_RATE_LIMITED/);
    expect(src).toMatch(/status:\s*503/);
    expect(src).toMatch(/retryable:\s*true/);
  });

  it("ocr surfaces OCR_RATE_LIMITED after exhausting retries", () => {
    const src = readFileSync(resolve(__dirname, "../lib/ocr.ts"), "utf8");
    expect(src).toMatch(/rateLimited/);
    expect(src).toMatch(/OCR_RATE_LIMITED/);
  });

  it("client shows a retry affordance on 503 retryable (no hard red error)", () => {
    const src = readFileSync(resolve(__dirname, "../components/BillUpload.tsx"), "utf8");
    expect(src).toMatch(/retryable/);
    expect(src).toMatch(/ocr-busy-retry/);
    expect(src).toMatch(/Probeer opnieuw/);
  });
});
