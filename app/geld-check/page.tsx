import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import GeldCheckClient from "./GeldCheckClient";

// Flag wordt op request gelezen (env-var-flip moet direct doorslaan).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Geld-check — vind je toeslagen | DeGeldHeld",
  description:
    "Gratis check: welke toeslagen + gemeente-regelingen loop je mis? Indicatie op de 2026-grenzen — geen DigiD, geen opslag.",
};

export default function GeldCheckPage() {
  if (!isEnabled("GELD_CHECK_ENABLED")) {
    // Dark-shipped tot eigenaar privacy/disclaimer heeft gereviewed.
    redirect("/");
  }
  return <GeldCheckClient />;
}
