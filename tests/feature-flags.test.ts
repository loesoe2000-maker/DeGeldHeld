import { describe, it, expect, beforeEach } from "vitest";
import { isEnabled, snapshot, FLAG_DEFAULTS, type FeatureFlag } from "../lib/feature-flags";

const ALL_FLAGS = Object.keys(FLAG_DEFAULTS) as FeatureFlag[];

function clearAll() {
  for (const k of ALL_FLAGS) delete process.env[`FEATURE_${k}`];
}

beforeEach(() => {
  clearAll();
});

describe("feature-flags: defaults", () => {
  it("defaults reflect the registry without env overrides", () => {
    for (const k of ALL_FLAGS) {
      expect(isEnabled(k)).toBe(FLAG_DEFAULTS[k]);
    }
  });

  it("PSD2_ENABLED defaults to false (needs external account)", () => {
    expect(isEnabled("PSD2_ENABLED")).toBe(false);
  });

  it("WHATSAPP_ENABLED defaults to false (needs Twilio approval)", () => {
    expect(isEnabled("WHATSAPP_ENABLED")).toBe(false);
  });

  it("PAYWALL_ENABLED defaults to true (live since v6)", () => {
    expect(isEnabled("PAYWALL_ENABLED")).toBe(true);
  });

  it("MULTI_ROUND_ENABLED defaults to true", () => {
    expect(isEnabled("MULTI_ROUND_ENABLED")).toBe(true);
  });

  it("PDF_OCR_ENABLED defaults to true", () => {
    expect(isEnabled("PDF_OCR_ENABLED")).toBe(true);
  });
});

describe("feature-flags: env override", () => {
  it("FEATURE_X=true turns on a default-off flag", () => {
    process.env.FEATURE_PSD2_ENABLED = "true";
    expect(isEnabled("PSD2_ENABLED")).toBe(true);
  });

  it("FEATURE_X=false turns off a default-on flag", () => {
    process.env.FEATURE_PAYWALL_ENABLED = "false";
    expect(isEnabled("PAYWALL_ENABLED")).toBe(false);
  });

  it("invalid values fall back to default (not coerced to true)", () => {
    process.env.FEATURE_PAYWALL_ENABLED = "yes";
    expect(isEnabled("PAYWALL_ENABLED")).toBe(true); // default
    process.env.FEATURE_PSD2_ENABLED = "1";
    expect(isEnabled("PSD2_ENABLED")).toBe(false); // default
  });

  it("each flag is independently toggleable", () => {
    process.env.FEATURE_PAYWALL_ENABLED = "false";
    process.env.FEATURE_MULTI_ROUND_ENABLED = "false";
    expect(isEnabled("PAYWALL_ENABLED")).toBe(false);
    expect(isEnabled("MULTI_ROUND_ENABLED")).toBe(false);
    expect(isEnabled("REFERRAL_ENABLED")).toBe(true); // untouched
  });
});

describe("feature-flags: snapshot", () => {
  it("returns one boolean per flag", () => {
    const snap = snapshot();
    for (const k of ALL_FLAGS) {
      expect(typeof snap[k]).toBe("boolean");
    }
    expect(Object.keys(snap).length).toBe(ALL_FLAGS.length);
  });

  it("snapshot reflects env overrides", () => {
    process.env.FEATURE_WHATSAPP_ENABLED = "true";
    const snap = snapshot();
    expect(snap.WHATSAPP_ENABLED).toBe(true);
  });
});
