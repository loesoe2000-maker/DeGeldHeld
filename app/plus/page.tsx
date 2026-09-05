import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * v41 — het betaalde Plus-pakket bestaat niet meer: het platform is
 * volledig gratis. Redirect in plaats van 404, want /plus staat nog in oude
 * links, de footer en twee smoke-scripts.
 */
export default function PlusPage() {
  redirect("/prijs");
}
