import Link from "next/link";
import Footer from "@/components/Footer";
import SeoBreadcrumb from "@/components/SeoBreadcrumb";

/**
 * v33 SEO landing — Zorgtoeslag 2026 misgelopen.
 *
 * Hook: het CPB schat dat ~10% van de rechthebbenden de zorgtoeslag
 * niet aanvraagt = ~€1 mld/jaar onbenut. We brengen de 2026-grenzen
 * keihard, en sturen door naar /geld-check voor een gratis indicatie.
 *
 * Bronnen (BENEFITS_DATA_2026.md):
 * - Belastingdienst — max. inkomen zorgtoeslag (€ 40.857 / € 51.142)
 * - Belastingdienst — max. vermogen zorgtoeslag (€ 146.011 / € 184.633)
 * - Zorgwijzer — zorgtoeslag 2026 (max bedragen € 129 / € 246 per maand)
 */

export const dynamic = "force-static";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";
const PAGE_PATH = "/zorgtoeslag-2026-misgelopen";

export const metadata = {
  title: "Zorgtoeslag 2026 misgelopen? — bedragen + check | DeGeldHeld",
  description:
    "Zorgtoeslag 2026: tot € 129/mnd alleenstaand, € 246/mnd partners. Inkomensgrens € 40.857, vermogensgrens € 146.011. Doe de gratis indicatie-check.",
  alternates: { canonical: `${APP_URL}${PAGE_PATH}` },
  openGraph: {
    title: "Zorgtoeslag 2026 misgelopen? — bedragen + check",
    description:
      "Veel Nederlanders laten zorgtoeslag liggen. Bekijk de 2026-grenzen en doe een gratis indicatie-check zonder DigiD.",
    url: `${APP_URL}${PAGE_PATH}`,
    type: "article",
  },
};

const faqs = [
  {
    q: "Heb ik recht op zorgtoeslag in 2026?",
    a: "Je hebt mogelijk recht als je 18+ bent, een Nederlandse basisverzekering hebt, je toetsingsinkomen onder € 40.857 (alleenstaand) of gezamenlijk € 51.142 (met toeslagpartner) ligt én je vermogen op 1 januari onder € 146.011 (alleenstaand) of € 184.633 (partners) blijft. Doe de gratis indicatie-check op /geld-check voor een snelle inschatting; voor het exacte bedrag rekent de Belastingdienst.",
  },
  {
    q: "Hoeveel zorgtoeslag krijg ik maximaal in 2026?",
    a: "Maximaal € 129 per maand alleenstaand en € 246 per maand voor toeslagpartners samen. Dat maximum geldt bij lage inkomens; naarmate je inkomen richting de grens stijgt, bouwt de toeslag af naar € 0. We geven daarom een bovengrens — voor het exacte bedrag staat de officiële proefberekening van de Belastingdienst.",
  },
  {
    q: "Hoeveel mensen laten zorgtoeslag liggen?",
    a: "Het CPB en SCP schatten dat circa 10% van de rechthebbenden geen zorgtoeslag aanvraagt — samen goed voor honderden miljoenen euro's per jaar die ongebruikt op de plank blijven liggen. Vooral jongere starters, mensen die net buiten het partnerinkomen vallen en mensen die nog geen ervaring hebben met toeslagen-aanvragen, missen het regelmatig.",
  },
  {
    q: "Kan ik zorgtoeslag met terugwerkende kracht aanvragen?",
    a: "Ja, tot maximaal het lopende én voorgaande jaar — dus in 2026 kun je zorgtoeslag 2025 nog aanvragen, mits je over dat jaar binnen de inkomens- en vermogensgrenzen viel. Aanvragen kan via Mijn Toeslagen met DigiD. Wij of derden kunnen de aanvraag niet voor je indienen.",
  },
  {
    q: "Wat doet DeGeldHeld bij zorgtoeslag?",
    a: "We bieden een gratis indicatie-check op /geld-check waarmee je in een paar vragen ziet of zorgtoeslag voor jou loont. Alles rekent in je browser — geen DigiD, geen registratie, en we slaan je inkomens- of vermogensdata niet op. Bij 'mogelijk recht' linken we naar de officiële proefberekening.",
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
    { "@type": "ListItem", position: 2, name: "Zorgtoeslag 2026 misgelopen", item: `${APP_URL}${PAGE_PATH}` },
  ],
};

export default function ZorgtoeslagPage() {
  return (
    <>
      <SeoBreadcrumb trail={[{ label: "Zorgtoeslag 2026 misgelopen" }]} />
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
            Zorgtoeslag 2026 misgelopen?
          </h1>
          <p className="mt-3 text-lg text-slate-700">
            Honderdduizenden Nederlanders laten zorgtoeslag liggen — vaak
            omdat ze denken dat ze er geen recht op hebben. In 2026
            ontvang je tot <strong>€ 129 per maand alleenstaand</strong> of{" "}
            <strong>€ 246 per maand met partner</strong>. Op deze pagina
            zie je de exacte 2026-grenzen, hoe je het aanvraagt, en doe je
            een gratis indicatie-check.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">
            Waar heb je recht op?
          </h2>
          <p className="mt-3 text-slate-700">
            Voor zorgtoeslag in 2026 gelden vier voorwaarden tegelijk: je
            bent 18 jaar of ouder, je hebt een Nederlandse basisverzekering,
            je inkomen ligt onder de grens, én je vermogen op 1 januari
            blijft onder de grens. Zit je net boven de inkomensgrens? Dan
            heb je geen recht — er is geen geleidelijke afbouw door de
            grens heen.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">
            Inkomens- en vermogensgrenzen 2026
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: Belastingdienst (max. inkomen + max. vermogen zorgtoeslag).
          </p>
          {/* bron: https://www.belastingdienst.nl/wps/wcm/connect/nl/zorgtoeslag/content/maximaal-inkomen-voor-zorgtoeslag */}
          {/* bron: https://www.belastingdienst.nl/wps/wcm/connect/nl/zorgtoeslag/content/maximaal-vermogen-zorgtoeslag */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Veld</th>
                  <th className="py-1 pr-3">Alleenstaand</th>
                  <th className="py-1">Met toeslagpartner</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr>
                  <td className="py-1 pr-3">Max. jaarinkomen</td>
                  <td className="py-1 pr-3">€ 40.857</td>
                  <td className="py-1">€ 51.142 (gezamenlijk)</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3">Max. vermogen op 1-1-2026</td>
                  <td className="py-1 pr-3">€ 146.011</td>
                  <td className="py-1">€ 184.633</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3">Max. zorgtoeslag</td>
                  <td className="py-1 pr-3">€ 129 / mnd</td>
                  <td className="py-1">€ 246 / mnd</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Let op — het maximum is de bovengrens.</strong> Het
            volledige maximum geldt bij lage inkomens. Naarmate je inkomen
            richting de grens stijgt, bouwt de toeslag af naar € 0. Voor het{" "}
            <em>exacte</em> bedrag rekent de Belastingdienst — wij geven
            alleen een indicatie of het loont om te kijken.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Hoeveel mensen lopen dit mis?
          </h2>
          <p className="mt-3 text-slate-700">
            Het CPB en SCP schatten dat circa <strong>10% van de
            rechthebbenden</strong> de zorgtoeslag niet aanvraagt — samen
            goed voor honderden miljoenen euro's per jaar die ongebruikt op
            de plank blijven liggen. Vooral starters net na hun studie,
            zzp'ers met een fluctuerend inkomen, en mensen die net buiten
            het partnerinkomen vallen, missen het regelmatig.
          </p>
          <p className="mt-3 text-slate-700">
            Een veelvoorkomende denkfout: "Ik verdien te veel." Maar in
            2026 mag je tot <strong>€ 40.857 bruto per jaar</strong>{" "}
            verdienen en nog steeds recht hebben. Dat is ruim boven het
            minimumloon en kan in deeltijd-banen of starter-functies prima
            van toepassing zijn.
          </p>
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
              — een paar vragen over je inkomen, vermogen en huishouden, en
              we tonen 'mogelijk recht' of 'waarschijnlijk geen recht'. We
              slaan je gegevens niet op.
            </li>
            <li>
              <strong>Doe de officiële proefberekening</strong> op{" "}
              belastingdienst.nl voor het exacte bedrag dat bij jouw
              situatie hoort.
            </li>
            <li>
              <strong>Vraag aan in Mijn Toeslagen</strong> → Zorgtoeslag
              aanvragen. Je hebt DigiD nodig. Aanvragen kunnen tot een jaar
              terug (in 2026 dus nog over heel 2025).
            </li>
            <li>
              <strong>Houd wijzigingen door</strong>: inkomensstijging,
              partner erbij, vermogensgrens overschreden — meld dat in Mijn
              Toeslagen om terugvorderingen te voorkomen.
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
            Eén vragenlijst checkt zorgtoeslag, huurtoeslag, kindgebonden
            budget én gemeente-regelingen tegelijk. Geen DigiD, geen
            registratie, alles rekent in je browser. Binnen 30 seconden
            weet je waar het mogelijk loont.
          </p>
          <Link
            href="/geld-check"
            className="mt-5 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Naar de gratis geld-check →
          </Link>
        </section>

        <footer className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <strong>Indicatie, geen advies.</strong> De grenzen op deze
          pagina zijn afkomstig uit officiële bronnen (Belastingdienst,
          Zorgwijzer 2026-overzicht). Het exacte bedrag bepaalt de
          Belastingdienst via de proefberekening; aanvragen kan tot 1
          jaar met terugwerkende kracht. DeGeldHeld geeft{" "}
          <strong>geen financieel of fiscaal advies</strong> in de zin
          van de Wft.
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
