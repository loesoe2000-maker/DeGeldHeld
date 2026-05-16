import { describe, it, expect } from "vitest";
import {
  t,
  makeT,
  isLocale,
  parseAcceptLanguage,
  DICTIONARIES,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from "@/lib/i18n";

describe("i18n — basic translation", () => {
  it("NL hero title is Dutch", () => {
    expect(t("nl", "hero_title")).toBe("Bespaar op je vaste lasten");
  });
  it("EN hero title is 'Save on your monthly bills'", () => {
    expect(t("en", "hero_title")).toBe("Save on your monthly bills");
  });
  it("DE hero title is German", () => {
    expect(t("de", "hero_title")).toMatch(/Sparen.*Fixkosten/i);
  });
  it("FR hero title is French", () => {
    expect(t("fr", "hero_title")).toMatch(/Économisez/);
  });

  it("makeT produces stable per-locale translator", () => {
    const tnl = makeT("nl");
    const ten = makeT("en");
    expect(tnl("hero_cta")).toBe("Upload je rekening");
    expect(ten("hero_cta")).toBe("Upload your bill");
  });
});

describe("i18n — dictionary coverage", () => {
  it("all 4 locales have all keys", () => {
    const keys = Object.keys(DICTIONARIES.nl);
    for (const locale of SUPPORTED_LOCALES) {
      const dict = DICTIONARIES[locale];
      for (const k of keys) {
        expect(dict[k as keyof typeof dict], `${locale} missing ${k}`).toBeDefined();
        expect((dict[k as keyof typeof dict] as string).length).toBeGreaterThan(0);
      }
    }
  });
  it("has 40+ translation keys", () => {
    expect(Object.keys(DICTIONARIES.nl).length).toBeGreaterThanOrEqual(40);
  });
});

describe("i18n — Accept-Language parsing", () => {
  it("prefers first matching language", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9,nl;q=0.8")).toBe("en");
    expect(parseAcceptLanguage("nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
    expect(parseAcceptLanguage("de-DE,de;q=0.9")).toBe("de");
    expect(parseAcceptLanguage("fr-FR")).toBe("fr");
  });

  it("falls back to NL when no match", () => {
    expect(parseAcceptLanguage("ja-JP,ja;q=0.9")).toBe(DEFAULT_LOCALE);
    expect(parseAcceptLanguage("")).toBe(DEFAULT_LOCALE);
    expect(parseAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
  });
});

describe("i18n — isLocale type guard", () => {
  it("accepts nl/en/de/fr", () => {
    for (const l of ["nl", "en", "de", "fr"]) {
      expect(isLocale(l)).toBe(true);
    }
  });
  it("rejects others", () => {
    expect(isLocale("ja")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("i18n — language switch changes hero text", () => {
  it("nl → en switch yields different hero", () => {
    const nl = t("nl", "hero_title");
    const en = t("en", "hero_title");
    expect(nl).not.toBe(en);
    expect(en).toContain("Save");
  });
});
