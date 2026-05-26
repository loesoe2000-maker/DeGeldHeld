import Link from "next/link";
import Footer from "@/components/Footer";
import SeoBreadcrumb from "@/components/SeoBreadcrumb";

/**
 * v33 SEO landing — Huurtoeslag 2026 berekenen.
 *
 * Belangrijke V31-discipline-anchor: de "max-huurgrens" van € 932,93 is
 * sinds 2026 GEEN drempel meer voor toegang — het is alleen een aftopping
 * in de officiële berekening. Aggregators noemen dit nog wel als drempel;
 * wij volgen Rijksoverheid/Woonbond.
 *
 * Bronnen (V29_DATA_2026.md / BENEFITS_DATA_2026.md):
 * - Rijksoverheid — huurtoeslagparameters 2026
 * - Woonbond — normen + grenzen huurtoeslag
 * - Belastingdienst — maximaal vermogen huurtoeslag
 */

export const dynamic = "force-static";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";
const PAGE_PATH = "/huurtoeslag-2026-berekenen";

export const metadata = {
  title: "Huurtoeslag 2026 berekenen — wel/geen recht? | DeGeldHeld",
  description:
    "Huurtoeslag 2026 zelf berekenen: nieuwe regel, vermogensgrens € 38.479, kwaliteitskorting + aftopping. Geen vaste inkomensgrens. Doe de gratis check.",
  alternates: { canonical: `${APP_URL}${PAGE_PATH}` },
  openGraph: {
    title: "Huurtoeslag 2026 berekenen — wel/geen recht?",
    description:
      "Belangrijk in 2026: max-huurgrens vervalt als toegangsdrempel. Vermogensgrens, kwaliteitskorting en gratis indicatie-check.",
    url: `${APP_URL}${PAGE_PATH}`,
    type: "article",
  },
};

const faqs = [
  {
    q: "Is er een vaste inkomensgrens voor huurtoeslag in 2026?",
    a: "Nee. Anders dan voor zorgtoeslag of kindgebonden budget bestaat er voor huurtoeslag in 2026 geen vaste inkomensgrens. Of je recht hebt — en hoeveel — hangt af van een formule met je huur, leeftijd, huishouden en vermogen. Doe de officiële proefberekening bij de Belastingdienst voor het exacte bedrag.",
  },
  {
    q: "Is de max-huurgrens van € 932,93 nog een drempel?",
    a: "Nee, niet meer. Vanaf 2026 is de maximale huurgrens (€ 932,93) géén voorwaarde meer om huurtoeslag te krijgen. Ook met een hogere huur kun je nog huurtoeslag aanvragen; in de berekening wordt de huur boven € 932,93 wél afgetopt op € 932,93. Bron: Rijksoverheid (huurtoeslagparameters 2026).",
  },
  {
    q: "Hoeveel vermogen mag ik hebben voor huurtoeslag?",
    a: "Maximaal € 38.479 per persoon op 1 januari 2026. Voor partners samen geldt ongeveer € 76.958. Boven die grens vervalt het recht op huurtoeslag — onafhankelijk van je inkomen of huur. Bron: Belastingdienst.",
  },
  {
    q: "Hoe vraag ik huurtoeslag aan?",
    a: "Via MijnBelastingdienst → Toeslagen → Huurtoeslag aanvragen. Je hebt DigiD nodig. Het exacte bedrag berekent de Belastingdienst voor je via de officiële proefberekening; doe die altijd voordat je aanvraagt. Wij of derden kunnen geen aanvraag voor je indienen — DigiD is persoonlijk.",
  },
  {
    q: "Wat doet DeGeldHeld bij huurtoeslag?",
    a: "We bieden een gratis indicatie-check op /geld-check: vul je situatie in (huur, vermogen, leeftijd, huishouden) en we tonen 'mogelijk recht' of 'waarschijnlijk geen recht' + een link naar de officiële proefberekening. Alles rekent in je eigen browser; we slaan je inkomens- of huurdata niet op.",
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
    { "@type": "ListItem", position: 2, name: "Huurtoeslag 2026 berekenen", item: `${APP_URL}${PAGE_PATH}` },
  ],
};

export default function HuurtoeslagPage() {
  return (
    <>
      <SeoBreadcrumb trail={[{ label: "Huurtoeslag 2026 berekenen" }]} />
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
            Toeslagen · peildatum 2026
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Huurtoeslag 2026 berekenen
          </h1>
          <p className="mt-3 text-lg text-slate-700">
            Huurtoeslag is een complexe regeling met meerdere drempels —
            kwaliteitskortingsgrens, aftoppingsgrenzen en
            vermogensgrens. In 2026 verdwijnt de maximale huurgrens als
            <strong> toegangsdrempel</strong>, dus ook met een hogere huur
            kun je nu recht hebben. Op deze pagina lees je de actuele 2026-
            grenzen, hoe het werkt en hoe je het aanvraagt.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">
            Waar heb je recht op?
          </h2>
          <p className="mt-3 text-slate-700">
            Of je recht hebt op huurtoeslag hangt af van vier dingen samen:
            je <strong>kale huur</strong> per maand, je{" "}
            <strong>vermogen</strong> op 1 januari, je{" "}
            <strong>huishouden</strong> (alleenstaand of met partner) en je{" "}
            <strong>leeftijd</strong>. Er is{" "}
            <strong>geen vaste inkomensgrens</strong> — anders dan bij
            zorgtoeslag of kindgebonden budget. De Belastingdienst rekent het
            bedrag voor je uit; wij geven je een indicatie of het loont om
            aan te vragen.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">
            Huurgrenzen 2026
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: Rijksoverheid (huurtoeslagparameters 2026) + Woonbond.
          </p>
          {/* bron: https://www.rijksoverheid.nl/actueel/nieuws/2025/11/25/indexering-inkomensgrenzen-woningcorporaties-maximale-huurprijsgrenzen-en-huurtoeslagparameters-2026 */}
          {/* bron: https://www.woonbond.nl/thema/huren-en-geld/normen-en-grenzen-huurtoeslag/ */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Grens</th>
                  <th className="py-1">Bedrag (per maand)</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr><td className="py-1 pr-3">Kwaliteitskortingsgrens</td><td className="py-1">€ 498,20</td></tr>
                <tr><td className="py-1 pr-3">Lage aftoppingsgrens</td><td className="py-1">€ 713,02</td></tr>
                <tr><td className="py-1 pr-3">Hoge aftoppingsgrens</td><td className="py-1">€ 764,14</td></tr>
                <tr><td className="py-1 pr-3">Max. rekenhuur (aftopping)</td><td className="py-1">€ 932,93</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Belangrijk — nieuw in 2026:</strong> de maximale huurgrens
            (€ 932,93) is <strong>géén voorwaarde</strong> meer om huurtoeslag
            te krijgen. Ook bij een huur boven dat bedrag kun je nog
            huurtoeslag aanvragen; in de berekening wordt de huur boven €
            932,93 wél <em>afgetopt</em> op € 932,93. Veel oudere
            informatie-pagina's noemen dit nog wel als drempel — die zijn niet
            meer actueel.
          </p>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Vermogensgrens
          </h3>
          <p className="mt-1 text-sm text-slate-600">Bron: Belastingdienst.</p>
          {/* bron: https://www.belastingdienst.nl/wps/wcm/connect/nl/huurtoeslag/content/maximaal-vermogen-huurtoeslag */}
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li>
              <strong>€ 38.479</strong> per persoon op 1 januari 2026.
            </li>
            <li>
              Voor partners samen geldt circa <strong>€ 76.958</strong> (2× per persoon).
            </li>
            <li>Boven die grens vervalt het recht — onafhankelijk van inkomen of huur.</li>
          </ul>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Subsidiepercentages per huur-band
          </h3>
          <p className="mt-2 text-slate-700">
            Globale uitleg (de exacte rekensom doet de Belastingdienst):
          </p>
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li>
              Tot € 498,20 → de Belastingdienst vergoedt circa{" "}
              <strong>100%</strong> van de huur boven de basisbijdrage.
            </li>
            <li>
              Tussen € 498,20 en € 713,02 → ongeveer <strong>65%</strong>.
            </li>
            <li>
              Boven de hoge aftoppingsgrens (€ 764,14) → ongeveer{" "}
              <strong>40%</strong>.
            </li>
            <li>
              Boven € 932,93 → aftopping op € 932,93 (de huur erboven telt
              niet meer mee in de rekensom, maar je houdt recht op de
              afgetopte berekening).
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Hoe vraag je het aan?
          </h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-slate-700">
            <li>
              <strong>Doe eerst onze gratis check</strong> via{" "}
              <Link href="/geld-check" className="text-brand-700 underline">
                /geld-check
              </Link>{" "}
              — we geven aan of je <em>mogelijk</em> recht hebt en linken naar
              de officiële proefberekening. Je inkomens-, huur- en
              vermogensgegevens blijven in je browser.
            </li>
            <li>
              <strong>Doe daarna de officiële proefberekening</strong> bij de
              Belastingdienst. Daar krijg je het{" "}
              <em>exacte</em> bedrag dat bij jouw situatie hoort.
            </li>
            <li>
              <strong>Aanvragen doe je in MijnBelastingdienst</strong> →
              Toeslagen → Huurtoeslag → Aanvragen. Je hebt DigiD nodig. Wij of
              andere derden kunnen geen aanvraag voor je indienen.
            </li>
            <li>
              <strong>Houd wijzigingen door</strong>: trouwen, samenwonen,
              verhuizen, vermogensmutatie boven de grens → meld dat via Mijn
              Toeslagen, anders krijg je een terugvordering.
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
            Vul je situatie in en krijg binnen 30 seconden een indicatie of
            huurtoeslag (en andere toeslagen: zorgtoeslag, kindgebonden
            budget, gemeente-regelingen) voor jou loont. Geen DigiD, geen
            registratie, alles rekent in je browser.
          </p>
          <Link
            href="/geld-check"
            className="mt-5 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Naar de gratis geld-check →
          </Link>
        </section>

        <footer className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <strong>Indicatie, geen advies.</strong> De grenzen op deze pagina
          zijn afkomstig uit officiële bronnen (Rijksoverheid 2025-11-25,
          Woonbond, Belastingdienst). Het exacte bedrag bepaalt de
          Belastingdienst via de proefberekening — controleer daar je
          situatie en houd wijzigingen door via Mijn Toeslagen om
          terugvorderingen te voorkomen. DeGeldHeld geeft{" "}
          <strong>geen financieel of fiscaal advies</strong> in de zin van de
          Wft.
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
