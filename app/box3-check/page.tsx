import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import Box3CheckClient from "./Box3CheckClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Box 3 rechtsherstel — vind je teruggave | DeGeldHeld",
  description:
    "Gratis check: loont een Opgaaf Werkelijk Rendement (Wet tegenbewijsregeling) " +
    "voor jouw box 3-jaar? Indicatie op de officiële 2017-2026 forfaits — geen DigiD, geen opslag.",
};

/**
 * v29 DEEL 1 — Box 3 rechtsherstel-check.
 * Flag-gated (default off) tot privacy/disclaimer-review eigenaar.
 */
export default function Box3CheckPage() {
  if (!isEnabled("BOX3_CHECK_ENABLED")) redirect("/");
  return <Box3CheckClient />;
}
