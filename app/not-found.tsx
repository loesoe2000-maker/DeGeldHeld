import Link from "next/link";

export const metadata = { title: "Pagina niet gevonden — DeGeldHeld" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 text-6xl font-bold text-slate-300">404</div>
      <h1 className="text-3xl font-bold text-slate-900">Deze pagina bestaat niet</h1>
      <p className="mt-3 max-w-md text-slate-600">
        De link die je probeerde te openen werkt niet meer of is nooit bestaan.
        Geen probleem — ga terug naar het begin.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          ← Terug naar home
        </Link>
        <Link
          href="/onderhandel"
          className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          Start onderhandeling
        </Link>
        <Link
          href="/faq"
          className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          Veelgestelde vragen
        </Link>
      </div>
    </main>
  );
}
