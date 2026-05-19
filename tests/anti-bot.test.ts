import { describe, it, expect } from "vitest";
import {
  evaluateAntiBot,
  looksLikeBotUserAgent,
  honeypotFilled,
  submittedTooFast,
  MIN_HUMAN_FORM_TIME_MS,
} from "@/lib/anti-bot";

describe("anti-bot signals (v15 DEEL 5)", () => {
  it("honeypotFilled: empty/null/whitespace → false; any content → true", () => {
    expect(honeypotFilled(null)).toBe(false);
    expect(honeypotFilled(undefined)).toBe(false);
    expect(honeypotFilled("")).toBe(false);
    expect(honeypotFilled("   ")).toBe(false);
    expect(honeypotFilled("anything")).toBe(true);
  });

  it("submittedTooFast: ≥2s → false; <2s → true", () => {
    const now = 1_000_000_000_000;
    expect(submittedTooFast(now - 3000, now)).toBe(false);
    expect(submittedTooFast(now - MIN_HUMAN_FORM_TIME_MS, now)).toBe(false);
    expect(submittedTooFast(now - 100, now)).toBe(true);
    expect(submittedTooFast(null, now)).toBe(false); // missing = allow
  });

  it("looksLikeBotUserAgent: known bot patterns → true", () => {
    expect(looksLikeBotUserAgent("curl/8.6.0")).toBe(true);
    expect(looksLikeBotUserAgent("python-requests/2.31.0")).toBe(true);
    expect(looksLikeBotUserAgent("Go-http-client/1.1")).toBe(true);
    // "Random Bot 1.0" — explicit " bot " word boundary.
    expect(looksLikeBotUserAgent("Random Bot 1.0")).toBe(true);
    expect(looksLikeBotUserAgent("HeadlessChrome/120")).toBe(true);
  });

  it("looksLikeBotUserAgent: regular browsers → false", () => {
    expect(
      looksLikeBotUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0",
      ),
    ).toBe(false);
    expect(looksLikeBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS) Safari/604.1")).toBe(false);
  });

  it("looksLikeBotUserAgent: missing UA → false (don't punish unknown clients)", () => {
    expect(looksLikeBotUserAgent(null)).toBe(false);
    expect(looksLikeBotUserAgent(undefined)).toBe(false);
    expect(looksLikeBotUserAgent("")).toBe(false);
  });

  it("evaluateAntiBot: ok when honeypot empty + time OK + UA clean", () => {
    const now = 1_000_000_000_000;
    const r = evaluateAntiBot(
      {
        honeypot: "",
        renderedAt: now - 5000,
        userAgent: "Mozilla/5.0 Chrome",
      },
      now,
    );
    expect(r.ok).toBe(true);
  });

  it("evaluateAntiBot: honeypot beats other checks", () => {
    const now = 1_000_000_000_000;
    const r = evaluateAntiBot(
      {
        honeypot: "I'm a bot",
        renderedAt: now - 5000,
        userAgent: "Mozilla",
      },
      now,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("honeypot");
  });

  it("evaluateAntiBot: too-fast → reason='too-fast'", () => {
    const now = 1_000_000_000_000;
    const r = evaluateAntiBot(
      { renderedAt: now - 500, userAgent: "Mozilla" },
      now,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-fast");
  });

  it("evaluateAntiBot: bot UA → reason='user-agent'", () => {
    const now = 1_000_000_000_000;
    const r = evaluateAntiBot(
      { renderedAt: now - 5000, userAgent: "curl/8.6" },
      now,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("user-agent");
  });
});
