import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Contact",
  description:
    "Bereik DeGeldHeld via e-mail, lees de FAQ of dien een AVG-verzoek in.",
};

export default function ContactPage() {
  return (
    <>
      <main className="mx-auto max-w-2xl px-6 py-16 text-slate-800">
        <h1 className="text-4xl font-bold text-slate-900">Contact</h1>
        <p className="mt-3 text-lg text-slate-600">
          Vragen, feedback of een AVG-verzoek? We reageren binnen 24u op werkdagen.
        </p>

        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <a
            href="mailto:hallo@degeldheld.com"
            className="block rounded-xl border border-slate-200 bg-white p-6 hover:border-brand-400"
          >
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              E-mail
            </div>
            <div className="mt-1 text-lg font-medium text-slate-900">
              hallo@degeldheld.com
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Voor support, partnerships en algemene vragen.
            </div>
          </a>

          <Link
            href="/faq"
            className="block rounded-xl border border-slate-200 bg-white p-6 hover:border-brand-400"
          >
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              FAQ
            </div>
            <div className="mt-1 text-lg font-medium text-slate-900">
              Veelgestelde vragen
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Misschien staat je antwoord er al.
            </div>
          </Link>
        </section>

        <section className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">AVG-verzoek</h2>
          <p className="mt-2 text-sm text-amber-900">
            Wil je je gegevens inzien, corrigeren of verwijderen? Stuur een
            e-mail naar{" "}
            <a
              href="mailto:hallo@degeldheld.com?subject=AVG-verzoek"
              className="font-medium underline"
            >
              hallo@degeldheld.com
            </a>{" "}
            met onderwerp <em>"AVG-verzoek"</em> en vermeld het type verzoek
            (inzage / correctie / verwijdering / dataportabiliteit). We
            verwerken het binnen 30 dagen, zoals voorgeschreven door de AVG.
          </p>
        </section>

        <p className="mt-10 text-xs text-slate-500">
          DeGeldHeld B.V. — KvK 00000000 — gevestigd in Nederland.
        </p>
      </main>
      <Footer />
    </>
  );
}
