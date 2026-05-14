import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeGeldHeld — automatisch onderhandelen op je maandlasten",
  description:
    "Upload je rekening, wij onderhandelen voor je met je provider. Je betaalt alleen 15% van wat je bespaart.",
  metadataBase: new URL(process.env.APP_URL ?? "https://degeldheld.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
