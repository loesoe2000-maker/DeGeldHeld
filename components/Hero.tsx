import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";

export default function Hero() {
  const geldCheckOn = isEnabled("GELD_CHECK_ENABLED");
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Houd je geld in <span className="text-brand-600">eigen zak</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
          Upload je telefoon-, internet- of energierekening. DeGeldHeld
          onderhandelt automatisch met je provider en je betaalt alleen
          <strong> 20% van wat we besparen</strong>.
        </p>

        <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/onderhandel"
            className="w-full rounded-lg bg-brand-600 px-8 py-3 text-center font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
          >
            Upload je rekening — gratis
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-slate-300 bg-white px-8 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Inloggen / account maken
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Geen account of betaling nodig om te proberen · Niet bespaard? Niets te
          betalen · NL providers ondersteund
        </p>
        <p className="mt-4">
          <Link
            href="/demo"
            className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
          >
            Bekijk hoe het werkt (30 sec) →
          </Link>
        </p>
        {geldCheckOn ? (
          <p className="mt-3">
            <Link
              href="/geld-check"
              className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
            >
              Of doe de gratis geld-check: welke toeslagen loop je mis? →
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
