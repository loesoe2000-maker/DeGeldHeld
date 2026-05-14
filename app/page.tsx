// Landing page placeholder — F1 vervangt dit met volledige hero + sections.
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-4xl font-bold text-brand-700">DeGeldHeld</h1>
      <p className="mt-4 text-lg text-slate-600">
        Automatisch onderhandelen op je Nederlandse maandlasten.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-block rounded-lg bg-brand-600 px-6 py-3 text-white hover:bg-brand-700"
      >
        Word lid
      </Link>
    </main>
  );
}
