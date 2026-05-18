import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin_auth";
import SeedSuccessForm from "./SeedSuccessForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seed succesvolle onderhandeling — Admin" };

export default async function SeedSuccessPage() {
  if (!(await isAdmin())) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Seed succesvolle onderhandeling</h1>
      <p className="mt-2 text-sm text-slate-600">
        Voeg een historische onderhandeling toe aan /proof. Alleen gebruiken
        voor cases die je <strong>écht</strong> hebt uitgevoerd voor iemand
        (vrienden, familie). Geen fictie — we markeren elk record met
        ADMIN_SEEDED voor latere transparantie.
      </p>

      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Wat dit doet:</strong> maakt een anonieme test-user + Bill +
        Negotiation (state=SUCCESS) met de besparingsdata die je invult. Verschijnt
        direct op /proof in de aggregaten.
      </div>

      <SeedSuccessForm />
    </main>
  );
}
