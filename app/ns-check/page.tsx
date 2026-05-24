import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import NsCheckClient from "./NsCheckClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NS Geld-Terug bij Vertraging — check je compensatie | DeGeldHeld",
  description:
    "Gratis indicatie op de officiële NS- en EU-PRR-regels (2026). Vul ticketprijs " +
    "+ vertraging → bedrag + brief-template. We claimen niet voor je — wel begeleiden we.",
};

/** v29 DEEL 2 — NS-vertraging check (flag-gated, default off). */
export default function NsCheckPage() {
  if (!isEnabled("NS_CHECK_ENABLED")) redirect("/");
  return <NsCheckClient />;
}
