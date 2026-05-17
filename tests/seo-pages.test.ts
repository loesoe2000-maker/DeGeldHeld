import { describe, it, expect } from "vitest";
import { SEO_PROVIDERS, SEO_CATEGORIES, findCategorySlug, findProviderSlug } from "../lib/seo-data";

describe("seo-data: registry shape", () => {
  it("has ≥30 provider slugs (top-30 SEO target)", () => {
    expect(SEO_PROVIDERS.length).toBeGreaterThanOrEqual(30);
  });

  it("has 4 category slugs (telecom/energie/verzekering/hypotheek)", () => {
    expect(SEO_CATEGORIES.length).toBe(4);
    expect(SEO_CATEGORIES.map((c) => c.slug).sort()).toEqual([
      "energie", "hypotheek", "telecom", "verzekering",
    ]);
  });

  it("provider slugs are unique", () => {
    const slugs = SEO_PROVIDERS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("provider slugs are URL-safe kebab-case", () => {
    for (const p of SEO_PROVIDERS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("each provider has intro + overpay + retention angle", () => {
    for (const p of SEO_PROVIDERS) {
      expect(p.intro.length).toBeGreaterThan(20);
      expect(p.averageOverpayEurMonth).toBeGreaterThan(0);
      expect(p.retentionAngle.length).toBeGreaterThan(5);
    }
  });

  it("findProviderSlug returns matching record", () => {
    expect(findProviderSlug("kpn")?.name).toBe("KPN");
    expect(findProviderSlug("nonexistent")).toBeUndefined();
  });

  it("findCategorySlug returns matching record", () => {
    expect(findCategorySlug("energie")?.label).toBe("energie");
    expect(findCategorySlug("xyz")).toBeUndefined();
  });

  it("each category has top providers + savings", () => {
    for (const c of SEO_CATEGORIES) {
      expect(c.topProviders.length).toBeGreaterThan(0);
      expect(c.averageYearlySaving).toBeGreaterThan(0);
    }
  });

  it("at least 30 + 4 = 34 unique SEO pages will exist", () => {
    expect(SEO_PROVIDERS.length + SEO_CATEGORIES.length).toBeGreaterThanOrEqual(34);
  });
});

describe("seo: generateStaticParams round-trip", () => {
  it("every provider slug round-trips through findProviderSlug", () => {
    for (const p of SEO_PROVIDERS) {
      expect(findProviderSlug(p.slug)?.name).toBe(p.name);
    }
  });
  it("every category slug round-trips", () => {
    for (const c of SEO_CATEGORIES) {
      expect(findCategorySlug(c.slug)?.label).toBe(c.label);
    }
  });
});
