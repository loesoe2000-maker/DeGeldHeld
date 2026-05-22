import { notFound } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import VluchtclaimClient from "./VluchtclaimClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vluchtclaim (EU261) — DeGeldHeld",
  description:
    "Was je vlucht ≥ 3 u vertraagd? Check je recht op €250–€600 compensatie via EU261. " +
    "Indicatie + no-cure-no-pay claim — geen vooruitbetaling.",
};

/**
 * v28 DEEL 4 — vluchtclaim entry-point. Hard achter FEATURE_CLAIMS tot de
 * eigenaar de flight-data-API + juridische check rond heeft. Off → 404
 * (geen claim-UI zichtbaar).
 */
export default function VluchtclaimPage() {
  if (!isEnabled("CLAIMS")) notFound();
  return <VluchtclaimClient />;
}
