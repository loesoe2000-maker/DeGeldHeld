import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimit } from "@/lib/rate-limit";

// The anonymous upload limit is keyed per SESSION (cookie) as the primary rail
// — so visitors behind a shared IP (mobile carrier NAT, school/office wifi)
// don't block each other during a traffic spike (e.g. a viral TikTok) — plus a
// loose per-IP backstop against a single IP hammering. Bots are separately
// gated by the Turnstile CAPTCHA, so these limits are a UX rail, not anti-bot.
describe("anon upload rate-limit — per-session primary + per-IP backstop", () => {
  beforeEach(() => __resetRateLimit());

  it("first 6 anonymous uploads from the same session succeed", () => {
    for (let i = 0; i < 6; i++) {
      const r = rateLimit({ key: "upload-anon-sess:sess_1", max: 6, windowSec: 3600 });
      expect(r.ok).toBe(true);
    }
  });

  it("7th upload from the same session within 1h → 429", () => {
    for (let i = 0; i < 6; i++) rateLimit({ key: "upload-anon-sess:sess_1", max: 6, windowSec: 3600 });
    const r7 = rateLimit({ key: "upload-anon-sess:sess_1", max: 6, windowSec: 3600 });
    expect(r7.ok).toBe(false);
    expect(r7.resetSec).toBeGreaterThan(0);
  });

  it("two visitors behind the SAME IP do not block each other (shared-IP fix)", () => {
    // Visitor A exhausts their own session bucket...
    for (let i = 0; i < 6; i++) rateLimit({ key: "upload-anon-sess:sessA", max: 6, windowSec: 3600 });
    // ...visitor B (same IP, different session cookie) is unaffected.
    const b = rateLimit({ key: "upload-anon-sess:sessB", max: 6, windowSec: 3600 });
    expect(b.ok).toBe(true);
  });

  it("loose per-IP backstop (120/h) still stops one IP hammering across sessions", () => {
    for (let i = 0; i < 120; i++) rateLimit({ key: "upload-anon-ip:1.2.3.4", max: 120, windowSec: 3600 });
    const over = rateLimit({ key: "upload-anon-ip:1.2.3.4", max: 120, windowSec: 3600 });
    expect(over.ok).toBe(false);
  });

  it("logged-in user keeps a separate per-user bucket (12/hour)", () => {
    for (let i = 0; i < 6; i++) rateLimit({ key: "upload-anon-sess:sess_x", max: 6, windowSec: 3600 });
    const r = rateLimit({ key: "upload:user_abc", max: 12, windowSec: 3600 });
    expect(r.ok).toBe(true);
  });
});
