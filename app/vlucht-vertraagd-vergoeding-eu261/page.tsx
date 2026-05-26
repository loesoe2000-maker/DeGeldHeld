import Link from "next/link";
import Footer from "@/components/Footer";
import SeoBreadcrumb from "@/components/SeoBreadcrumb";
import { isEnabled } from "@/lib/feature-flags";

/**
 * v33 SEO landing — Vlucht vertraagd: vergoeding op grond van EU261.
 *
 * Bronnen (V29_DATA_2026.md / BENEFITS_DATA_2026.md + lib/eu261.ts):
 * - Verordening (EG) 261/2004 — drempels 1500 / 3500 km, 3u / 4u
 * - Bedragen € 250 / € 400 / € 600 (EU261-stabiel, in 2026 ongewijzigd)
 * - NL verjaring: 2 jaar na vluchtdatum
 * - Buitengewone omstandigheden uitgezonderd; personeelsstaking eigen
 *   maatschappij telt NIET als overmacht (= wél recht)
 *
 * De /vluchtclaim-knop is conditioneel op de CLAIMS-flag; zonder flag
 * verwijzen we naar de EU-officiële uitleg + DIY-pad.
 */

export const dynamic = "force-static";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";
const PAGE_PATH = "/vlucht-vertraagd-vergoeding-eu261";

export const metadata = {
  title: "Vlucht vertraagd: vergoeding (EU261) — bedragen + check | DeGeldHeld",
  description:
    "Vlucht vertraagd? EU261 geeft € 250 / € 400 / € 600 bij ≥ 3u (of 4u >3500km). Verjaring 2 jaar. Check je recht en kies zelf of via no-cure-no-pay.",
  alternates: { canonical: `${APP_URL}${PAGE_PATH}` },
  openGraph: {
    title: "Vlucht vertraagd: vergoeding op grond van EU261",
    description:
      "Per Verordening 261/2004 heb je bij ≥ 3 uur vertraging recht op € 250 – € 600. Bekijk de drempels en doe een gratis check.",
    url: `${APP_URL}${PAGE_PATH}`,
    type: "article",
  },
};

const faqs = [
  {
    q: "Wanneer heb ik recht op EU261-vergoeding?",
    a: "Bij een vertraging van ≥ 3 uur op de eindbestemming, mits de vlucht uit de EU vertrok of met een EU-maatschappij in de EU aankwam. Het bedrag is € 250 (≤ 1.500 km), € 400 (EU > 1.500 km of niet-EU 1.500-3.500 km) of € 600 (> 3.500 km, ≥ 4 u). Buitengewone omstandigheden (extreem weer, ATC-staking) sluiten het recht uit — personeelsstaking van de eigen maatschappij doet dat NIET.",
  },
  {
    q: "Hoeveel krijg ik precies?",
    a: "€ 250 bij vluchten tot 1.500 km, € 400 bij EU-vluchten > 1.500 km of niet-EU-vluchten tussen 1.500 en 3.500 km, en € 600 bij vluchten > 3.500 km met ≥ 4 uur vertraging. Tussen 3 en 4 uur op een lange-afstandsvlucht kan een halvering gelden (jurisprudentie); laat dat geval door een specialist beoordelen.",
  },
  {
    q: "Hoe lang heb ik om te claimen?",
    a: "In Nederland verjaart de claim na 2 jaar na de vluchtdatum. Begin dus niet te lang te wachten — bewaar boardingpassen, mailbevestigingen en eventuele communicatie van de maatschappij over de oorzaak.",
  },
  {
    q: "Is dit hetzelfde als de NS-vergoeding?",
    a: "Nee. EU261 (Verordening (EG) 261/2004) regelt luchtvaart, terwijl NS-vergoedingen via de EU-PRR (Verordening (EU) 2021/782) en NS-voorwaarden lopen. Voor vertraagde treinen zie /ns-geld-terug-vertraging.",
  },
  {
    q: "Wat als de maatschappij weigert?",
    a: "Veel maatschappijen wijzen claims eerst af onder verwijzing naar 'operationele redenen' of 'overmacht'. Vraag schriftelijk om de specifieke reden en bewaar het antwoord. Lukt het niet zelf? Dan kun je een no-cure-no-pay-partij inschakelen (we verwijzen je dan; we bouwen dit niet zelf). Geen besparing/uitkering = geen kosten.",
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
    { "@type": "ListItem", position: 2, name: "Vlucht vertraagd — EU261-vergoeding", item: `${APP_URL}${PAGE_PATH}` },
  ],
};

export default function VluchtEu261Page() {
  const claimsOn = isEnabled("CLAIMS");
  return (
    <>
      <SeoBreadcrumb trail={[{ label: "Vlucht vertraagd — EU261-vergoeding" }]} />
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
            Reizigersrechten · stabiel sinds 2004
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Vlucht vertraagd: vergoeding op grond van EU261
          </h1>
          <p className="mt-3 text-lg text-slate-700">
            Bij een vertraging van <strong>3 uur of meer</strong> op de
            eindbestemming heb je vaak recht op{" "}
            <strong>€ 250 tot € 600</strong> per persoon — los van wat je
            ticket kostte. De regels staan in Verordening (EG){" "}
            <strong>261/2004</strong> en gelden in 2026 onveranderd. Op
            deze pagina lees je de drempels, hoe je het claimt en wat de
            valkuilen zijn.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">
            Waar heb je recht op?
          </h2>
          <p className="mt-3 text-slate-700">
            Drie compensatiebanden, afhankelijk van afstand en
            vertragingsduur. De afstand is de grootcirkelafstand van het
            vertrekvliegveld tot de eindbestemming (niet de afgelegde
            route).
          </p>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">
            EU261-compensatiebanden 2026
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: Europa.eu (rechten vliegtuigpassagiers) · EUclaim.
          </p>
          {/* bron: https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_nl.htm */}
          {/* bron: https://www.euclaim.nl/vlucht-problemen/rechten-van-vliegtuigpassagiers/verordening-261-2004 */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Bedrag</th>
                  <th className="py-1">Voorwaarde</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr>
                  <td className="py-1 pr-3 font-semibold">€ 250</td>
                  <td className="py-1">Vlucht ≤ 1.500 km, ≥ 3 u vertraging op aankomst</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3 font-semibold">€ 400</td>
                  <td className="py-1">EU-vlucht &gt; 1.500 km óf niet-EU 1.500-3.500 km, ≥ 3 u</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3 font-semibold">€ 600</td>
                  <td className="py-1">Vlucht &gt; 3.500 km, ≥ 4 u vertraging</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Wanneer geldt het wél en wanneer niet?
          </h3>
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li>
              <strong>Geldt</strong>: bij vertrek vanuit een EU-land
              (ongeacht maatschappij) óf bij aankomst in de EU met een{" "}
              EU-maatschappij.
            </li>
            <li>
              <strong>Niet</strong> bij echte buitengewone omstandigheden
              (extreem weer, vogelaanvaring, ATC-staking, security-incident
              op de luchthaven).
            </li>
            <li>
              <strong>Wél</strong> bij personeelsstaking van de eigen
              maatschappij — die telt volgens jurisprudentie niet als
              overmacht.
            </li>
            <li>
              <strong>Wél</strong> ook als de vlucht is geannuleerd binnen
              14 dagen voor vertrek zonder passende alternatieve route.
            </li>
          </ul>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Verjaring
          </h3>
          <p className="mt-2 text-slate-700">
            In Nederland verjaart de EU261-vordering <strong>2 jaar na
            de vluchtdatum</strong>. Bewaar boardingpass, ticket-bevestiging
            en eventuele e-mails over de oorzaak — die zijn cruciaal als
            de maatschappij later 'buitengewone omstandigheden' claimt.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Hoe vraag je het aan?
          </h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-slate-700">
            <li>
              <strong>Doe een gratis indicatie-check</strong> — vul je
              vluchtnummer, datum en afstand in. We rekenen de afstand om
              naar de juiste band en tonen of je in aanmerking komt.
            </li>
            <li>
              <strong>Verzamel je bewijs</strong>: boardingpass,
              ticketbevestiging, e-mail/SMS van de maatschappij over
              vertraging, en zo mogelijk een screenshot van een
              flight-tracker met de werkelijke aankomsttijd.
            </li>
            <li>
              <strong>Dien zelf de claim in</strong> via het
              klanttenservice-kanaal van de maatschappij (gratis, geen
              fee). Krijg je een afwijzing of geen reactie binnen ~4
              weken? Schakel dan een no-cure-no-pay-partij in.
            </li>
            <li>
              <strong>Houd termijnen in de gaten</strong>: 2 jaar
              NL-verjaring. Veel passagiers verliezen hun recht door te
              wachten.
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
            Vul je vluchtnummer en datum in en zie binnen 30 seconden of
            je waarschijnlijk recht hebt op een EU261-vergoeding. Geen
            registratie, geen DigiD — gewoon de verordening toegepast op
            jouw vlucht.
          </p>
          {claimsOn ? (
            <Link
              href="/vluchtclaim"
              data-testid="vluchtclaim-cta"
              className="mt-5 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Check je vlucht →
            </Link>
          ) : (
            <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong>Vluchtclaim-flow staat momenteel in lock-step met
              onze juridische voorbereiding.</strong> Tot we live gaan,
              raden we aan rechtstreeks bij de maatschappij te claimen of
              een specialist (no-cure-no-pay) in te schakelen — zie de
              officiële{" "}
              <a
                href="https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_nl.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 underline"
              >
                Europa.eu-uitleg
              </a>{" "}
              voor je rechten.
            </p>
          )}
        </section>

        <footer className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <strong>Indicatie, geen advies.</strong> De drempels en
          bedragen op deze pagina volgen Verordening (EG) 261/2004 en
          NL-verjaring van 2 jaar; de jurisprudentie over halvering
          tussen 3-4 uur op lange-afstandsvluchten kan per situatie
          afwijken. DeGeldHeld is geen advocaat of claim-bureau en geeft{" "}
          <strong>geen financieel of juridisch advies</strong> in de zin
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
