import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import ZorgkostenCheckClient from "./ZorgkostenCheckClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Zorgkosten-check — vind je aftrek | DeGeldHeld",
  description:
    "Gratis indicatie + checklist veelvergeten zorgkosten (2026-drempel: max(€166, 1,65% × inkomen)). " +
    "Geen DigiD, geen opslag — je rekent in je eigen browser.",
};

/** v29 DEEL 3 — Zorgkostenaftrek check (flag-gated, default off). */
export default function ZorgkostenCheckPage() {
  if (!isEnabled("ZORGKOSTEN_CHECK_ENABLED")) redirect("/");
  return <ZorgkostenCheckClient />;
}
