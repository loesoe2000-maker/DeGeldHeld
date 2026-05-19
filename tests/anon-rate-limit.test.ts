import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimit } from "@/lib/rate-limit";

describe("anon upload IP rate-limit (3/hour) — v15 DEEL 1c", () => {
  beforeEach(() => __resetRateLimit());

  it("first 3 anonymous uploads from same IP succeed", () => {
    for (let i = 0; i < 3; i++) {
      const r = rateLimit({ key: "upload-anon:1.2.3.4", max: 3, windowSec: 3600 });
      expect(r.ok).toBe(true);
    }
  });

  it("4th anonymous upload within 1 hour → 429", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit({ key: "upload-anon:1.2.3.4", max: 3, windowSec: 3600 });
    }
    const r4 = rateLimit({ key: "upload-anon:1.2.3.4", max: 3, windowSec: 3600 });
    expect(r4.ok).toBe(false);
    expect(r4.resetSec).toBeGreaterThan(0);
  });

  it("different IPs do NOT share the bucket", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit({ key: "upload-anon:1.1.1.1", max: 3, windowSec: 3600 });
    }
    const otherIp = rateLimit({ key: "upload-anon:2.2.2.2", max: 3, windowSec: 3600 });
    expect(otherIp.ok).toBe(true);
  });

  it("logged-in user keeps the per-user 5/hour bucket (separate)", () => {
    // Anon bucket exhausted...
    for (let i = 0; i < 3; i++) {
      rateLimit({ key: "upload-anon:9.9.9.9", max: 3, windowSec: 3600 });
    }
    // ...the per-user bucket for an actual user is unaffected.
    const r = rateLimit({ key: "upload:user_abc", max: 5, windowSec: 3600 });
    expect(r.ok).toBe(true);
  });
});
