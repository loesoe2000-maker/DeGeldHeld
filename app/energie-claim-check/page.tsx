import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import EnergieClaimCheckClient from "./EnergieClaimCheckClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Energie-eindafrekening-claim — vind je restitutie | DeGeldHeld",
  description:
    "Gratis check: kloppen je heffingen, je tarief en je meterstand op de eindafrekening? " +
    "Indicatie + DIY-klachtbrief — geen DigiD, geen opslag.",
};

/**
 * v35 DEEL 2 — Energie-eindafrekening-claim via Geschillencommissie Energie.
 * Flag-gated (default off) tot privacy/disclaimer-review + 2026-energiebelasting-
 * verificatie eigenaar.
 */
export default function EnergieClaimCheckPage() {
  if (!isEnabled("ENERGIE_CLAIM_CHECK_ENABLED")) redirect("/");
  return <EnergieClaimCheckClient />;
}
