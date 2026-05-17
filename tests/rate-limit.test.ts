import { describe, it, expect, beforeEach } from "vitest";
import {
  rateLimit,
  rateLimitResponse,
  ipFromRequest,
  __resetRateLimit,
} from "../lib/rate-limit";

beforeEach(() => __resetRateLimit());

describe("rateLimit", () => {
  it("allows up to `max` requests in window", () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit({ key: "u1", max: 5, windowSec: 60 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(5 - i - 1);
    }
  });

  it("blocks the (max+1)th request", () => {
    for (let i = 0; i < 10; i++) rateLimit({ key: "u2", max: 10, windowSec: 3600 });
    const r = rateLimit({ key: "u2", max: 10, windowSec: 3600 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetSec).toBeGreaterThan(0);
  });

  it("keys are isolated per identifier", () => {
    for (let i = 0; i < 3; i++) rateLimit({ key: "alice", max: 3, windowSec: 60 });
    const blocked = rateLimit({ key: "alice", max: 3, windowSec: 60 });
    const bob = rateLimit({ key: "bob", max: 3, windowSec: 60 });
    expect(blocked.ok).toBe(false);
    expect(bob.ok).toBe(true);
  });

  it("11 calls within 1 hour → 11th is 429 (DEEL 3 spec)", () => {
    let last = rateLimit({ key: "spec", max: 10, windowSec: 3600 });
    for (let i = 0; i < 9; i++) last = rateLimit({ key: "spec", max: 10, windowSec: 3600 });
    expect(last.ok).toBe(true);
    const eleventh = rateLimit({ key: "spec", max: 10, windowSec: 3600 });
    expect(eleventh.ok).toBe(false);
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with Retry-After header", () => {
    const res = rateLimitResponse({ ok: false, remaining: 0, resetSec: 42, limit: 10 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("body has rate_limited error code", async () => {
    const res = rateLimitResponse({ ok: false, remaining: 0, resetSec: 10, limit: 5 });
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(body.retryAfterSec).toBe(10);
    expect(body.message).toMatch(/rustig/i);
  });
});

describe("ipFromRequest", () => {
  it("prefers x-forwarded-for first hop", () => {
    const req = new Request("http://t/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(ipFromRequest(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://t/", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(ipFromRequest(req)).toBe("9.9.9.9");
  });

  it("uses 'anon' when no headers", () => {
    const req = new Request("http://t/");
    expect(ipFromRequest(req)).toBe("anon");
  });
});
