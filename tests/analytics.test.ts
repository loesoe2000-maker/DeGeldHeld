import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  track,
  identify,
  setAnalyticsEnabled,
  sanitizeAnalyticsUrl,
  sanitizeAnalyticsProperties,
} from "@/lib/analytics";

const captures: Array<{ event: string; props?: unknown }> = [];
vi.mock("posthog-js", () => ({
  default: {
    capture: (event: string, props?: unknown) => captures.push({ event, props }),
    identify: () => {},
  },
}));

beforeEach(() => {
  captures.length = 0;
  setAnalyticsEnabled(false);
});
afterEach(() => setAnalyticsEnabled(false));

describe("v24 analytics — no-op without PostHog", () => {
  it("track() does nothing until analytics is enabled (no key)", () => {
    track("landing_view");
    track("upload_succeeded", { category: "TELECOM" });
    expect(captures).toHaveLength(0);
  });
  it("identify() is a no-op when disabled", () => {
    identify("user_123");
    expect(captures).toHaveLength(0);
  });
  it("once enabled, track() forwards the event", () => {
    setAnalyticsEnabled(true);
    track("analyse_viewed", { category: "ENERGIE", supported: true });
    expect(captures).toEqual([{ event: "analyse_viewed", props: { category: "ENERGIE", supported: true } }]);
  });
});

describe("v24 analytics — URL/PII sanitisation", () => {
  it("strips query strings (bill ids / tokens) from captured URLs", () => {
    expect(sanitizeAnalyticsUrl("https://x.nl/onderhandel/analyse?bill=abc123")).toBe(
      "https://x.nl/onderhandel/analyse",
    );
    expect(sanitizeAnalyticsUrl("https://x.nl/uitkomst?token=secret")).toBe("https://x.nl/uitkomst");
    expect(sanitizeAnalyticsUrl("https://x.nl/prijs")).toBe("https://x.nl/prijs");
  });
  it("sanitize_properties redacts query strings on url-like fields", () => {
    const out = sanitizeAnalyticsProperties({
      $current_url: "https://x.nl/p?bill=1&token=2",
      $referrer: "https://x.nl/q?token=3",
      distinct_id: "anon",
    });
    expect(out.$current_url).toBe("https://x.nl/p");
    expect(out.$referrer).toBe("https://x.nl/q");
    expect(out.distinct_id).toBe("anon"); // non-url props untouched
  });
});

describe("v24 analytics — masking present on sensitive surfaces", () => {
  const root = resolve(__dirname, "..");
  const read = (p: string) => readFileSync(resolve(root, p), "utf8");

  it("analyse page masks its financial content with ph-no-capture", () => {
    expect(read("app/onderhandel/analyse/page.tsx")).toMatch(/ph-no-capture/);
  });
  it("email page masks the email body/teaser with ph-no-capture", () => {
    expect(read("app/onderhandel/email/page.tsx")).toMatch(/ph-no-capture/);
  });
  it("PostHog provider masks inputs + .ph-no-capture text + is cookieless EU", () => {
    const src = read("components/PostHogProvider.tsx");
    expect(src).toMatch(/maskAllInputs:\s*true/);
    expect(src).toMatch(/maskTextSelector:\s*"\.ph-no-capture"/);
    expect(src).toMatch(/persistence:\s*"memory"/);
    expect(src).toMatch(/eu\.i\.posthog\.com/);
  });
  it("identify only passes a userId (never reads an email field)", () => {
    const src = read("components/AnalyticsIdentify.tsx");
    expect(src).toMatch(/identify\(userId\)/);
    expect(src).not.toMatch(/\.email/);
  });
});
