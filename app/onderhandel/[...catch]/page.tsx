import Link from "next/link";

export const metadata = { title: "Onderhandel-stap niet gevonden — DeGeldHeld" };

/**
 * Catch-all voor onbekende /onderhandel/* sub-paths. Stuurt user terug naar
 * de onderhandel-start zonder de session te verliezen.
 */
export default function OnderhandelNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">
        Deze onderhandel-stap bestaat niet
      </h1>
      <p className="mt-3 text-slate-600">
        Misschien klopte de link niet of is je sessie verlopen. Begin opnieuw
        met je rekening uploaden.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/onderhandel"
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Start opnieuw
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          Mijn dashboard
        </Link>
      </div>
    </main>
  );
}
