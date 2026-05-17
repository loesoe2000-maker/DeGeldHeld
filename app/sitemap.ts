import type { MetadataRoute } from "next";
import { SEO_PROVIDERS, SEO_CATEGORIES } from "@/lib/seo-data";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

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
  return [...core, ...providers, ...cats];
}
