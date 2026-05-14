// Placeholder — F4 vervangt met drag&drop upload + Groq Vision OCR
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OnderhandelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/onderhandel");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Nieuwe onderhandeling</h1>
      <p className="mt-2 text-slate-600">Upload je rekening om te starten.</p>
    </main>
  );
}
