import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import HuurcommissieCheckClient from "./HuurcommissieCheckClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Huurcommissie-bezwaar servicekosten — vind je restitutie | DeGeldHeld",
  description:
    "Gratis check: heb je grond voor bezwaar tegen je servicekosten-afrekening? " +
    "Indicatie op de officiële Huurcommissie-rode vlaggen (2026) — geen DigiD, geen opslag.",
};

/**
 * v35 DEEL 1 — Huurcommissie-bezwaar servicekosten.
 * Flag-gated (default off) tot privacy/disclaimer-review eigenaar.
 */
export default function HuurcommissieCheckPage() {
  if (!isEnabled("HUURCOMMISSIE_CHECK_ENABLED")) redirect("/");
  return <HuurcommissieCheckClient />;
}
