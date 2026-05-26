import type { MetadataRoute } from "next";
import { SEO_PROVIDERS, SEO_CATEGORIES } from "@/lib/seo-data";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

/**
 * v33 — keyword-targeted SEO landing-pages voor de gevalideerde checks.
 * Bewust géén pages voor onderhandel-flow (KPN-test verdict pending).
 */
const V33_LANDING_PAGES = [
  "/box3-rechtsherstel-aanvragen-2026",
  "/huurtoeslag-2026-berekenen",
  "/zorgtoeslag-2026-misgelopen",
  "/vlucht-vertraagd-vergoeding-eu261",
  "/ns-geld-terug-vertraging",
  "/zorgkostenaftrek-aangifte-2026",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/proof`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/demo`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${APP_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/voorwaarden`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/over-ons`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
  const v33: MetadataRoute.Sitemap = V33_LANDING_PAGES.map((p) => ({
    url: `${APP_URL}${p}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.85, // hogere prio dan provider/category-pages — keyword-targeted
  }));
  const providers: MetadataRoute.Sitemap = SEO_PROVIDERS.map((p) => ({
    url: `${APP_URL}/onderhandelen-met-${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const cats: MetadataRoute.Sitemap = SEO_CATEGORIES.map((c) => ({
    url: `${APP_URL}/${c.slug}-besparen`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));
  return [...core, ...v33, ...providers, ...cats];
}
