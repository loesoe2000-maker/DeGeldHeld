import { describe, it, expect, beforeEach } from "vitest";
import { negotiatorCache, ocrCache, groqLimiter, cacheKey } from "../lib/llm_cache";

describe("llm_cache/cacheKey", () => {
  it("joins parts with pipe", () => {
    expect(cacheKey(["a", 1, "b"])).toBe("a|1|b");
  });
  it("treats null/undefined as empty", () => {
    expect(cacheKey(["a", null, "b", undefined, "c"])).toBe("a||b||c");
  });
  it("is deterministic for same input", () => {
    expect(cacheKey(["x", 5])).toBe(cacheKey(["x", 5]));
  });
});

describe("llm_cache/TtlCache", () => {
  beforeEach(() => {
    negotiatorCache.clear();
    ocrCache.clear();
  });

  it("returns null for missing key", () => {
    expect(negotiatorCache.get("nope")).toBeNull();
  });

  it("returns set value", () => {
    negotiatorCache.set("k", { v: 1 });
    expect(negotiatorCache.get("k")).toEqual({ v: 1 });
  });

  it("expires after TTL", () => {
    negotiatorCache.set("k", "v", 0);
    expect(negotiatorCache.get("k")).toBeNull();
  });

  it("size reflects entries", () => {
    negotiatorCache.set("a", 1);
    negotiatorCache.set("b", 2);
    expect(negotiatorCache.size()).toBe(2);
  });

  it("clear removes all", () => {
    negotiatorCache.set("a", 1);
    negotiatorCache.clear();
    expect(negotiatorCache.size()).toBe(0);
  });
});

describe("llm_cache/RateLimiter", () => {
  beforeEach(() => groqLimiter.reset());

  it("allows under per-minute cap", () => {
    for (let i = 0; i < 5; i++) {
      expect(groqLimiter.check().ok).toBe(true);
      groqLimiter.record();
    }
  });

  it("blocks at per-minute cap", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) groqLimiter.record(now);
    expect(groqLimiter.check(now + 1).ok).toBe(false);
  });

  it("recovers after 60s window", () => {
    const now = 2_000_000;
    for (let i = 0; i < 5; i++) groqLimiter.record(now);
    expect(groqLimiter.check(now + 61_000).ok).toBe(true);
  });

  it("countLastMinute is accurate", () => {
    const now = 3_000_000;
    groqLimiter.record(now);
    groqLimiter.record(now + 30_000);
    expect(groqLimiter.countLastMinute(now + 31_000)).toBe(2);
  });

  it("blocks at per-day cap", () => {
    const now = 4_000_000;
    for (let i = 0; i < 100; i++) groqLimiter.record(now - i * 1000); // spread over time
    const r = groqLimiter.check(now);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/day/);
  });
});
