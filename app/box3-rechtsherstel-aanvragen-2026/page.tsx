import Link from "next/link";
import Footer from "@/components/Footer";
import SeoBreadcrumb from "@/components/SeoBreadcrumb";

/**
 * v33 SEO landing — Box 3-rechtsherstel-aanvragen-2026.
 *
 * ALLE forfaits / heffingsvrij vermogen / deadlines komen EXACT uit
 * docs/V29_DATA_2026.md (Belastingdienst / Rijksoverheid / Wikipedia
 * historie). Élk getal heeft een // bron:-comment. Tests verifiëren dat
 * de getoonde getallen matchen met lib/box3.ts-constants (drift-protection).
 */

export const dynamic = "force-static";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";
const PAGE_PATH = "/box3-rechtsherstel-aanvragen-2026";

export const metadata = {
  title: "Box 3-rechtsherstel aanvragen in 2026 — OWR-deadlines + check | DeGeldHeld",
  description:
    "Box 3-rechtsherstel aanvragen in 2026: Wet tegenbewijsregeling juli 2025, OWR-deadlines (1 mei en 1 oktober 2026), forfaits-tabel en gratis indicatie-check.",
  alternates: { canonical: `${APP_URL}${PAGE_PATH}` },
  openGraph: {
    title: "Box 3-rechtsherstel aanvragen in 2026 — OWR-deadlines + check",
    description:
      "Wet tegenbewijsregeling juli 2025 + OWR-deadlines + forfaits 2017-2026 + gratis indicatie of OWR voor jou loont.",
    url: `${APP_URL}${PAGE_PATH}`,
    type: "article",
  },
};

const faqs = [
  {
    q: "Wat is de Wet tegenbewijsregeling Box 3?",
    a: "De Wet tegenbewijsregeling Box 3 (Stb. 2025, ingegaan op 19 juli 2025) geeft je het recht om vermindering te vragen als je werkelijke rendement lager was dan het forfaitaire rendement waarop de Belastingdienst je box 3-belasting baseerde. Aanvragen doe je via het OWR-formulier (Opgaaf Werkelijk Rendement) in MijnBelastingdienst.",
  },
  {
    q: "Tot wanneer kan ik OWR aanvragen voor 2021–2024?",
    a: "Voor 2021 tot en met 2024 is de deadline 1 mei 2026 als je zelf indient, en 1 oktober 2026 als een belastingadviseur het voor je doet. De deadline voor 2020 is al verlopen op 31 december 2025; actie daarvoor is helaas te laat. Bron: Auxilium / Taxlive.",
  },
  {
    q: "Vanaf welk vermogen loont een OWR?",
    a: "Onder het heffingsvrij vermogen (in 2026: € 59.357 alleenstaand / € 118.714 met partner) betaal je geen box 3-belasting — een OWR levert dan niets op. Boven die grens hangt het af van het verschil tussen je werkelijke rendement (interest spaargeld + dividend + koersresultaat ± kosten) en het fictieve rendement op je vermogen.",
  },
  {
    q: "Wat doet DeGeldHeld bij een Box 3-claim?",
    a: "We tonen je gratis een indicatie van de vermindering op /box3-check (alles client-side, geen DigiD) en maken de brief voor je klaar. Dat kost niets — DeGeldHeld is volledig gratis.",
  },
  {
    q: "Wat als de OCR mijn beschikking niet goed leest?",
    a: "Dan markeren we de claim als FAILED en nemen we handmatig contact op voor verificatie — je hoort dan van ons. Er gaat sowieso nooit geld af: DeGeldHeld is gratis.",
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
    { "@type": "ListItem", position: 2, name: "Box 3-rechtsherstel aanvragen 2026", item: `${APP_URL}${PAGE_PATH}` },
  ],
};

export default function Box3RechtsherstelPage() {
  return (
    <>
      <SeoBreadcrumb trail={[{ label: "Box 3-rechtsherstel 2026" }]} />
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
            Wet tegenbewijsregeling · 2026
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Box 3-rechtsherstel aanvragen in 2026
          </h1>
          <p className="mt-3 text-lg text-slate-700">
            Sinds 19 juli 2025 geldt de Wet tegenbewijsregeling Box 3:
            betaalde je box 3-belasting over 2017–2024 op een{" "}
            <strong>hoger fictief rendement</strong> dan je werkelijk
            ontving, dan heb je recht op vermindering via een{" "}
            <strong>Opgaaf Werkelijk Rendement (OWR)</strong>. Op deze
            pagina lees je wanneer een OWR loont, welke deadlines er gelden
            en hoe je 'm aanvraagt.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">
            Waar heb je recht op?
          </h2>
          <p className="mt-3 text-slate-700">
            Je hebt recht op vermindering wanneer je <em>werkelijke</em>{" "}
            rendement over een belastingjaar lager was dan het{" "}
            <em>forfaitaire</em> rendement dat de Belastingdienst voor dat
            jaar hanteert. Hoe groter de afstand, hoe groter de potentiële
            teruggave. De Hoge Raad oordeelde op{" "}
            <strong>6 juni 2024</strong> en{" "}
            <strong>14 juni 2024</strong> dat het oude stelsel in strijd
            was met het EVRM voor spaarders en voorzichtige beleggers met
            laag rendement — en op{" "}
            <strong>20 december 2024</strong> dat eigen woning in box 3 tot
            en met 2025 op een voordeel van € 0 wordt gewaardeerd.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">
            Forfaitaire rendementen 2017–2026
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: Belastingdienst (officieel 2026); Wikipedia (historie 2017–2025).
          </p>
          {/* bron: https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026 */}
          {/* bron: https://nl.wikipedia.org/wiki/Box_3 */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Jaar</th>
                  <th className="py-1 pr-3">Banktegoeden</th>
                  <th className="py-1 pr-3">Overige bezittingen</th>
                  <th className="py-1 pr-3">Schulden</th>
                  <th className="py-1">Tarief</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr><td className="py-1 pr-3">2017</td><td className="py-1 pr-3">0,25%</td><td className="py-1 pr-3">5,39%</td><td className="py-1 pr-3">3,43%</td><td className="py-1">30%</td></tr>
                <tr><td className="py-1 pr-3">2018</td><td className="py-1 pr-3">0,12%</td><td className="py-1 pr-3">5,38%</td><td className="py-1 pr-3">3,20%</td><td className="py-1">30%</td></tr>
                <tr><td className="py-1 pr-3">2019</td><td className="py-1 pr-3">0,08%</td><td className="py-1 pr-3">5,59%</td><td className="py-1 pr-3">3,00%</td><td className="py-1">30%</td></tr>
                <tr><td className="py-1 pr-3">2020</td><td className="py-1 pr-3">0,04%</td><td className="py-1 pr-3">5,28%</td><td className="py-1 pr-3">2,74%</td><td className="py-1">30%</td></tr>
                <tr><td className="py-1 pr-3">2021</td><td className="py-1 pr-3">0,01%</td><td className="py-1 pr-3">5,69%</td><td className="py-1 pr-3">2,46%</td><td className="py-1">31%</td></tr>
                <tr><td className="py-1 pr-3">2022</td><td className="py-1 pr-3">0,00%</td><td className="py-1 pr-3">5,53%</td><td className="py-1 pr-3">2,28%</td><td className="py-1">31%</td></tr>
                <tr><td className="py-1 pr-3">2023</td><td className="py-1 pr-3">0,92%</td><td className="py-1 pr-3">6,17%</td><td className="py-1 pr-3">2,46%</td><td className="py-1">32%</td></tr>
                <tr><td className="py-1 pr-3">2024</td><td className="py-1 pr-3">1,44%</td><td className="py-1 pr-3">6,04%</td><td className="py-1 pr-3">2,61%</td><td className="py-1">36%</td></tr>
                <tr><td className="py-1 pr-3">2025</td><td className="py-1 pr-3">1,37%</td><td className="py-1 pr-3">5,88%</td><td className="py-1 pr-3">2,70%</td><td className="py-1">36%</td></tr>
                {/* bron 2026 officieel — aggregators noemen 1,44%, Belastingdienst publiceert 1,28% */}
                <tr className="font-semibold text-brand-800"><td className="py-1 pr-3">2026</td><td className="py-1 pr-3">1,28%</td><td className="py-1 pr-3">6,00%</td><td className="py-1 pr-3">2,70%</td><td className="py-1">36%</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            <strong>Let op:</strong> sommige aggregator-sites noemen het
            banktegoeden-forfait 2026 als 1,44%. De Belastingdienst publiceert
            zelf <strong>1,28%</strong> — dat zijn de officiële cijfers.
          </p>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Heffingsvrij vermogen 2026
          </h3>
          <p className="mt-1 text-slate-700">
            Onder deze grens betaal je geen box 3-belasting en heeft een OWR
            geen nut:
          </p>
          {/* bron: https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026 */}
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li><strong>€ 59.357</strong> — zonder fiscaal partner (2026)</li>
            <li><strong>€ 118.714</strong> — met fiscaal partner (2026)</li>
            <li><strong>€ 3.800</strong> — schuldendrempel: schulden tellen pas mee in de aftrek vanaf dit bedrag</li>
          </ul>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Wanneer loont een OWR? (eerlijke regel)
          </h3>
          <p className="mt-3 text-slate-700">
            Een OWR loont meestal alléén bij vermogen{" "}
            <strong>ruim boven</strong> het heffingsvrij vermogen, een
            jaar met fors lager werkelijk rendement dan het forfait, en een
            bewerkbaar bewijsspoor (jaaroverzichten bank, dividend- en
            koers-resultaat-overzichten). Wij helpen bij elk bedrag, ook een klein. Alles is gratis, dus er is
            geen reden om iemand af te wijzen. Geen verzonnen cijfers, geen
            valse hoop.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Hoe vraag je het aan?
          </h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-slate-700">
            <li>
              <strong>Doe eerst de gratis indicatie</strong> via{" "}
              <Link href="/box3-check" className="text-brand-700 underline">
                /box3-check
              </Link>
              . Je vult jaar, vermogenspositie en (optioneel) werkelijk
              rendement in. Alles rekent in je eigen browser — niets blijft op
              onze server.
            </li>
            <li>
              <strong>Verzamel je bewijsstukken</strong>: jaaroverzicht
              bank/spaartegoeden, dividend-/koersresultaat-overzichten van je
              beleggingen, eventuele aftrekbare kosten (advieskosten, BTW). Je
              hebt die nodig om je werkelijke rendement bij de Belastingdienst
              te onderbouwen.
            </li>
            <li>
              <strong>Dien het OWR-formulier in</strong> via
              MijnBelastingdienst (sinds 9 juli 2025 online). Je doet dit zelf
              met je DigiD — wij of een belastingadviseur kunnen niet voor je
              inloggen.
            </li>
            <li>
              <strong>Houd rekening met de doorlooptijd</strong>: de
              Belastingdienst verwerkt naar verwachting tot in{" "}
              <strong>2030</strong> alle ~10 miljoen formulieren. Geduld is
              een vereiste.
            </li>
          </ol>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">
            Deadlines die je niet wilt missen
          </h3>
          {/* bron: https://auxiliumadviesgroep.nl/nieuws/fiscaal/termijn-indienen-owr-formulier-box-3-verlengd/ */}
          {/* bron: https://www.taxlive.nl/nl/documenten/nieuws/termijn-motivering-box-3-bezwaren-verlengd-tot-1-oktober-2026/ */}
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li>
              <strong>1 mei 2026</strong> — deadline OWR voor 2021–2024 als je
              zelf indient.
            </li>
            <li>
              <strong>1 oktober 2026</strong> — deadline OWR voor 2021–2024
              wanneer je een belastingadviseur inschakelt (RB/NOB).
            </li>
            <li>
              <strong>31 december 2025</strong> — deadline voor 2020. Voor de
              meeste mensen is deze al{" "}
              <strong>verstreken</strong>; actie nu is meestal te laat.
            </li>
          </ul>
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
            Vul je jaar, vermogenspositie en (optioneel) werkelijk rendement
            in. We tonen een indicatie van de verwachte vermindering plus,
            áls je dat wilt, een gratis DIY-OWR-brief die je in
            MijnBelastingdienst kunt plakken. Wil je liever dat wij het
            opstellen? Dat kan ook, en het is net zo gratis.
          </p>
          <Link
            href="/box3-check"
            className="mt-5 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Naar de gratis Box 3-check →
          </Link>
        </section>

        <footer className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <strong>Indicatie, geen advies.</strong> De cijfers op deze pagina
          zijn afkomstig uit officiële bronnen (Belastingdienst, Rijksoverheid,
          Wikipedia historie). Het exacte bedrag van je vermindering bepaalt
          de Belastingdienst via het OWR-formulier in MijnBelastingdienst —
          controleer daar je situatie. Bij complexe vermogensposities (eigen
          woning in box 3, vastgoed, valuta, aftrekbare kosten) verdient een
          gespecialiseerde belastingadviseur (RB/NOB) de voorkeur. DeGeldHeld
          geeft <strong>geen financieel of fiscaal advies</strong> in de zin
          van de Wft of de NOB/RB-regels.
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
