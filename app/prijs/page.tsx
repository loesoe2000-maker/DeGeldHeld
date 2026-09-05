import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Wat het kost — DeGeldHeld",
  description:
    "DeGeldHeld is gratis: geen fee, geen percentage, geen abonnement. " +
    "Wat wél geld kost zijn de officiële procedures zelf — en dat geld gaat " +
    "naar die instantie, niet naar ons.",
};

/**
 * v41 — deze pagina toonde tot v40 een prijstabel met percentages en een
 * maandbedrag. Bewust GEEN redirect: /prijs is een URL waar mensen bewust
 * naartoe gaan met een concrete vraag, en die vraag verdient een antwoord in
 * plaats van een sprong naar de homepage.
 */
export default function PrijsPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
            Wat het kost
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-900 sm:text-5xl">
            Het gebruik is kosteloos
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            DeGeldHeld brengt geen fee, percentage of abonnement in rekening.
            Het bedrag dat je terugkrijgt gaat rechtstreeks van de instantie of
            je provider naar jou; wij beheren op geen enkel moment jouw geld.
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Wat wél geld kan kosten
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Sommige officiële procedures hebben eigen kosten. Die betaal je aan
            die instantie, niet aan ons — en meestal krijg je ze terug als je
            wint:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>
              <strong>Huurcommissie</strong> — € 25 leges per procedure.
            </li>
            <li>
              <strong>Geschillencommissie Energie</strong> — € 27,50 leges plus
              € 52,50 klachtgeld.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-700">
            De Belastingdienst rekent niets voor een Box 3-verzoek of een
            aangiftecorrectie. Toeslagen aanvragen is ook gratis.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900">
            Waarom is het gratis?
          </h2>
          <p className="mt-2 text-slate-700">
            DeGeldHeld is een niet-commercieel project. Een percentage over
            een teruggave weegt het zwaarst bij de mensen die deze hulp het
            hardst nodig hebben; dat vinden wij niet passen bij het doel. We
            ontvangen daarnaast geen vergoeding van providers: geen commissie,
            geen kickbacks en geen advertentiedeals. Er is dus geen belang dat
            boven het jouwe gaat.
          </p>
        </section>

        <div className="mt-10">
          <Link
            href="/vind-al-je-geld"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Start een gratis check →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
