import Link from "next/link";
import Footer from "@/components/Footer";
import SeoBreadcrumb from "@/components/SeoBreadcrumb";

/**
 * v33 SEO landing — NS "Geld Terug bij Vertraging".
 *
 * Bronnen (V29_DATA_2026.md):
 * - NS — wat compenseert NS (binnenland 30-59=50%, ≥60=100%)
 * - NS — voorwaarden Geld Terug bij Vertraging (PDF)
 * - NS Go support — indieningsdeadline ~1 maand
 * - Rover — geld terug bij vertraging
 * - EU-PRR Verordening (EU) 2021/782 (internationaal: 60-119=25%, ≥120=50%)
 *
 * Discipline-anchor: minimum claim € 2,30 + deadline 1 maand (NS Go) =
 * de bekendste valkuilen; we noemen ze expliciet. Eigen personeelsstaking
 * telt NIET als overmacht (parallel met EU261).
 */

export const dynamic = "force-static";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";
const PAGE_PATH = "/ns-geld-terug-vertraging";

export const metadata = {
  title: "NS geld terug bij vertraging — wanneer + hoeveel? | DeGeldHeld",
  description:
    "NS-vertraging? 30-59 min = 50%, ≥ 60 min = 100% van je rit terug. Internationaal via EU-PRR 25-50%. Deadline 1 maand, min € 2,30. Check je recht.",
  alternates: { canonical: `${APP_URL}${PAGE_PATH}` },
  openGraph: {
    title: "NS geld terug bij vertraging — wanneer + hoeveel?",
    description:
      "Binnenland: 50% bij 30-59 min, 100% bij ≥ 60 min. Internationaal volgt EU-PRR. Deadline 1 maand, minimum € 2,30 per claim.",
    url: `${APP_URL}${PAGE_PATH}`,
    type: "article",
  },
};

const faqs = [
  {
    q: "Wanneer heb ik recht op compensatie van NS?",
    a: "Bij binnenlandse NS-reizen krijg je 50% van je enkele-reisprijs terug bij 30-59 minuten vertraging op de eindbestemming en 100% bij ≥ 60 minuten. Voor internationale reizen geldt de EU-PRR (Verordening (EU) 2021/782): 25% bij 60-119 minuten en 50% bij ≥ 120 minuten. Voor abonnementhouders gelden eigen regels en/of vaste bedragen — controleer dat in Mijn NS.",
  },
  {
    q: "Is er een minimum-bedrag per claim?",
    a: "Ja: € 2,30. Claims lager dan dat bedrag worden niet in behandeling genomen. Houd dat in gedachten bij goedkope ritten — soms is een ritcombinatie of dagbundel het waard om wel of niet apart te claimen.",
  },
  {
    q: "Hoe lang heb ik om te claimen?",
    a: "Volgens NS Go support is de aanbevolen indieningsdeadline 1 maand na de vertraging. Voor losse OV-chipkaart-reizen schrijven sommige bronnen 3 maanden, maar wij raden 1 maand aan voor zekerheid. Wacht niet — bewaar het reisbewijs en dien zo snel mogelijk in via Mijn NS.",
  },
  {
    q: "Is staking ook overmacht (zoals bij EU261)?",
    a: "Staking van NS-personeel telt NIET als overmacht — daar blijft het recht op compensatie bestaan, parallel met de EU261-regels voor luchtvaart. Wel uitgesloten zijn echte buitengewone gebeurtenissen zoals nationale stroomuitval of natuurramp.",
  },
  {
    q: "Hoe dien ik een claim in?",
    a: "Voor abonnementen + OV-chipkaart-reizen via Mijn NS → 'Geld Terug bij Vertraging'. Voor losse tickets via het formulier op ns.nl. Reistijd van je werkelijke reis wordt automatisch opgehaald als je via Mijn NS reist. Verwerking duurt meestal enkele dagen, je krijgt een e-mail met de uitslag.",
  },
];

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "DeGeldHeld", item: `${APP_URL}/` },
    { "@type": "ListItem", position: 2, name: "NS geld terug bij vertraging", item: `${APP_URL}${PAGE_PATH}` },
  ],
};

export default function NsVertragingPage() {
  return (
    <>
      <SeoBreadcrumb trail={[{ label: "NS geld terug bij vertraging" }]} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:pt-14">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
            Reizigersrechten · regeling 2026
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            NS geld terug bij vertraging
          </h1>
          <p className="mt-3 text-lg text-slate-700">
            Stond je trein lang stil? NS keert <strong>50% terug bij
            30-59 minuten vertraging</strong> en{" "}
            <strong>100% bij 60 minuten of meer</strong> — gemeten op de
            eindbestemming. Internationale reizen vallen onder de EU-PRR
            met 25-50%. Op deze pagina lees je de drempels, de regels voor
            abonnementen, en hoe je het binnen 1 maand claimt.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">
            Waar heb je recht op?
          </h2>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">
            Binnenlandse losse tickets (NS-regeling)
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: NS — wat compenseert NS + voorwaarden Geld Terug bij Vertraging.
          </p>
          {/* bron: https://www.ns.nl/en/service-and-contact/refunds/what-compensation-does-ns-offer */}
          {/* bron: https://www.ns.nl/binaries/_ht_1754559946332/content/assets/ns-nl/voorwaarden/voorwaarden-geld-terug-bij-vertraging.pdf */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Vertraging op eindbestemming</th>
                  <th className="py-1">Compensatie</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr><td className="py-1 pr-3">&lt; 30 minuten</td><td className="py-1">Geen compensatie</td></tr>
                <tr><td className="py-1 pr-3 font-semibold">30-59 minuten</td><td className="py-1 font-semibold">50% van enkele-reis-prijs</td></tr>
                <tr><td className="py-1 pr-3 font-semibold">≥ 60 minuten</td><td className="py-1 font-semibold">100% van enkele-reis-prijs</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Internationale tickets (EU-PRR)
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: EU-PRR Verordening (EU) 2021/782.
          </p>
          {/* bron: https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32021R0782 */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Vertraging</th>
                  <th className="py-1">Compensatie</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr><td className="py-1 pr-3">&lt; 60 minuten</td><td className="py-1">Geen compensatie</td></tr>
                <tr><td className="py-1 pr-3 font-semibold">60-119 minuten</td><td className="py-1 font-semibold">25% van de ticketprijs</td></tr>
                <tr><td className="py-1 pr-3 font-semibold">≥ 120 minuten</td><td className="py-1 font-semibold">50% van de ticketprijs</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Abonnementhouders (kortings- en (Toeslag)abonnementen)
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: NS Go support — geld terug bij vertraging.
          </p>
          {/* bron: https://support.nsgo.nl/hc/nl/articles/13049625747473 */}
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li>
              <strong>15-29 minuten</strong>: 50% van het ticket óf een
              vast bedrag per (Toeslag)abonnement.
            </li>
            <li>
              <strong>≥ 30 minuten</strong>: 100% van het ticket óf een
              vast bedrag.
            </li>
            <li>
              <strong>Vrij-/Flex-abonnementen</strong> hebben eigen vaste
              compensatie-bedragen per vertraging — die verschillen per
              abonnement. Check het exacte bedrag in Mijn NS; wij verzinnen
              geen bedragen.
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Praktische regels
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="align-top">
                <tr><td className="py-1 pr-3 font-semibold">Minimum claim</td><td className="py-1">€ 2,30 — lagere claims worden niet in behandeling genomen.</td></tr>
                <tr><td className="py-1 pr-3 font-semibold">Indieningsdeadline</td><td className="py-1">1 maand na de vertraging (NS Go support). Wij raden 1 maand aan voor zekerheid.</td></tr>
                <tr><td className="py-1 pr-3 font-semibold">Indiening</td><td className="py-1">Via Mijn NS (OV-chipkaart / NS-Flex) of formulier op ns.nl (overige).</td></tr>
                <tr><td className="py-1 pr-3 font-semibold">Verwerking</td><td className="py-1">Meestal enkele dagen → e-mail met uitslag.</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Uitsluitingen / overmacht
          </h3>
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li>
              <strong>Geen compensatie</strong> bij echte overmacht:
              nationale stroomuitval, natuurramp, terreur.
            </li>
            <li>
              <strong>Wél compensatie</strong> bij staking van eigen
              NS-personeel — dat telt niet als overmacht (parallel met
              EU261-luchtvaart).
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Hoe vraag je het aan?
          </h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-slate-700">
            <li>
              <strong>Bewaar je reisgegevens</strong>: OV-chipkaart-reis,
              NS-Flex-rit of papieren ticket. Bij papier: bewaar de stub
              + de NS-afdracht-bevestiging.
            </li>
            <li>
              <strong>Open Mijn NS</strong> → "Geld Terug bij Vertraging"
              → kies de rit. NS-Flex en OV-chipkaart-ritten staan vaak al
              klaar.
            </li>
            <li>
              <strong>Voor losse papieren tickets</strong>: gebruik het
              formulier op ns.nl en upload een foto van het ticket.
            </li>
            <li>
              <strong>Binnen 1 maand indienen</strong> — wacht niet tot
              de vakantie voorbij is. NS verwerkt meestal binnen enkele
              dagen.
            </li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Veelgestelde vragen
          </h2>
          <div className="mt-4 space-y-4">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <summary className="cursor-pointer text-base font-semibold text-slate-900">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-slate-700">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Doe de gratis check →
          </h2>
          <p className="mt-3 text-slate-700">
            Vul je rit-gegevens in en zie wat je waarschijnlijk terugkrijgt.
            Geen registratie nodig — we rekenen lokaal in je browser en
            tonen welk formulier in Mijn NS bij jouw geval hoort.
          </p>
          <Link
            href="/ns-check"
            className="mt-5 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Naar de gratis NS-check →
          </Link>
        </section>

        <footer className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <strong>Indicatie, geen advies.</strong> Bedragen, drempels en
          deadlines op deze pagina volgen de NS-voorwaarden Geld Terug bij
          Vertraging (PDF), NS Go support en de EU-PRR Verordening (EU)
          2021/782. Voor abonnementen verschillen vaste vergoedingen per
          abonnement — check Mijn NS voor je exacte bedrag. DeGeldHeld
          geeft <strong>geen financieel of juridisch advies</strong> in
          de zin van de Wft.
        </footer>

        <div className="mt-8 text-center text-sm text-slate-500">
          <Link href="/" className="underline">
            ← Terug naar home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
