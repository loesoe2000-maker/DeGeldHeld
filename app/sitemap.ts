import type { MetadataRoute } from "next";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/proof`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/voorwaarden`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/over-ons`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}
