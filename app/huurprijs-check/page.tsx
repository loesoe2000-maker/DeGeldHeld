import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import { isAdmin } from "@/lib/admin_auth";
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
 * tot gate A uit docs/V40_PLAN.md gehaald is.
 *
 * v40 F4: admins komen er óók bij als de flag uit staat. Zonder dat kan de
 * pilot niet draaien — gate A vereist juist dat we deze check op echte
 * woningen uitvoeren en naast de officiële Huurprijscheck leggen.
 */
export default async function HuurprijsCheckPage() {
  const admin = await isAdmin();
  if (!isEnabled("HUURPRIJS_CHECK_ENABLED") && !admin) redirect("/");
  return <HuurprijsCheckClient isAdmin={admin} />;
}
