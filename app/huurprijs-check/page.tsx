import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import HuurprijsCheckClient from "./HuurprijsCheckClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Huurprijs-check — betaal je te veel huur?",
  description:
    "Gratis check op het officiële woningwaarderingsstelsel: hoeveel punten " +
    "heeft jouw woning, wat is de maximale huurprijs in 2026, en kun je " +
    "huurverlaging afdwingen? Geen DigiD, je gegevens blijven in je browser.",
};

/**
 * v40 F3 — /huurprijs-check. Flag-gated (HUURPRIJS_CHECK_ENABLED, default off)
 * tot de F4-pilot uit docs/V40_PLAN.md is gedraaid.
 */
export default function HuurprijsCheckPage() {
  if (!isEnabled("HUURPRIJS_CHECK_ENABLED")) redirect("/");
  return <HuurprijsCheckClient />;
}
