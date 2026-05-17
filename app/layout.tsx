import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import CookieBanner from "@/components/CookieBanner";
import { Analytics } from "@vercel/analytics/react";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "DeGeldHeld — automatisch onderhandelen op je maandlasten",
    template: "%s · DeGeldHeld",
  },
  description:
    "Upload je rekening, wij onderhandelen voor je met je provider. Je betaalt alleen 15% van wat je bespaart.",
  keywords: ["onderhandelen", "besparen", "maandlasten", "energie", "internet", "Nederland"],
  authors: [{ name: "DeGeldHeld" }],
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: APP_URL,
    siteName: "DeGeldHeld",
    title: "DeGeldHeld — automatisch onderhandelen op je maandlasten",
    description:
      "Upload je rekening, wij onderhandelen voor je met je provider. Je betaalt alleen 15% van wat je bespaart.",
    images: [{ url: "/api/og?title=DeGeldHeld", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeGeldHeld — automatisch onderhandelen op je maandlasten",
    description:
      "Upload je rekening, wij onderhandelen voor je met je provider. Je betaalt alleen 15% van wat je bespaart.",
    images: ["/api/og?title=DeGeldHeld"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <ToastProvider>
          {children}
          <CookieBanner />
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
