import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import CookieBanner from "@/components/CookieBanner";
import LegalFooter from "@/components/LegalFooter";
import PostHogProvider from "@/components/PostHogProvider";
import { Analytics } from "@vercel/analytics/react";

// www is het canonieke domein op prod (apex 307-redirect → www). De fallback
// MOET www zijn: anders wijzen og:url/og:image naar de apex en moet LinkedIns
// image-fetcher een redirect volgen — die haakt daar stilletjes op af en
// rendert dan een kale kaart zonder afbeelding.
const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "DeGeldHeld — haal terug wat van jou is",
    template: "%s · DeGeldHeld",
  },
  // v40 F1: claims-first. "No cure no pay" gaat over onze fee; de leges-
  // eerlijkheid staat op de check-pagina's zelf.
  description:
    "Gratis checks voor Box 3-belasting, huur- en servicekosten, energie-eindafrekening en toeslagen. Wij bereiden je claim voor, jij dient in. No cure, no pay: 20% van wat je terugkrijgt (Box 3: 25%), max € 500.",
  keywords: ["geld terugvragen", "box 3", "huurverlaging", "toeslagen", "besparen", "maandlasten", "energie", "Nederland"],
  authors: [{ name: "DeGeldHeld" }],
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: APP_URL,
    siteName: "DeGeldHeld",
    title: "DeGeldHeld — haal terug wat van jou is",
    description:
      "Gratis checks voor Box 3-belasting, huur- en servicekosten, energie-eindafrekening en toeslagen. Wij bereiden je claim voor, jij dient in. No cure, no pay: 20% van wat je terugkrijgt (Box 3: 25%), max € 500.",
    images: [{ url: "/api/og?title=DeGeldHeld", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeGeldHeld — haal terug wat van jou is",
    description:
      "Gratis checks voor Box 3-belasting, huur- en servicekosten, energie-eindafrekening en toeslagen. Wij bereiden je claim voor, jij dient in. No cure, no pay: 20% van wat je terugkrijgt (Box 3: 25%), max € 500.",
    images: ["/api/og?title=DeGeldHeld"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <PostHogProvider>
          <ToastProvider>
            {children}
            <LegalFooter />
            <CookieBanner />
          </ToastProvider>
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
