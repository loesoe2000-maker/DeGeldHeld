import Link from "next/link";
import Footer from "@/components/Footer";
import SeoBreadcrumb from "@/components/SeoBreadcrumb";

/**
 * v33 SEO landing — Zorgkostenaftrek in de aangifte 2026.
 *
 * Bronnen (V29_DATA_2026.md / lib/zorgkosten.ts):
 * - Belastingdienst — drempelbedrag 2026 (€ 166 / € 332)
 * - Belastingdienst — drempelbedrag 2025 (referentie € 164 / € 328)
 * - Formule: drempel = max(minimum, 1,65% × drempelinkomen)
 * - 113%-verhoging voor AOW-gerechtigden onder € 41.123 (2026)
 *
 * Disclaimer-discipline: dit is een aftrekpost in de inkomstenbelasting,
 * géén toeslag — we geven alleen een drempelindicatie + verwijzing naar
 * de aangifte. Geen aftrekpost faken; bedragen volgen de Belastingdienst.
 */

export const dynamic = "force-static";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";
const PAGE_PATH = "/zorgkostenaftrek-aangifte-2026";

export const metadata = {
  title: "Zorgkostenaftrek 2026 — drempel + check aangifte | DeGeldHeld",
  description:
    "Zorgkostenaftrek 2026: drempel = max(€ 166, 1,65% × inkomen). AOW-toeslag 113% onder € 41.123. Welke kosten tellen? Doe de gratis check.",
  alternates: { canonical: `${APP_URL}${PAGE_PATH}` },
  openGraph: {
    title: "Zorgkostenaftrek 2026 — drempel + check aangifte",
    description:
      "Specifieke zorgkosten in box 1: pas aftrekbaar boven de drempel. Bekijk de 2026-regels en doe een gratis check op /zorgkosten-check.",
    url: `${APP_URL}${PAGE_PATH}`,
    type: "article",
  },
};

const faqs = [
  {
    q: "Wat is de zorgkostenaftrek?",
    a: "Een aftrekpost in de inkomstenbelasting (specifieke zorgkosten — box 1). Je trekt zorgkosten die je zelf hebt betaald, en die de zorgverzekering niet vergoedt, af van je belastbaar inkomen. Het is géén toeslag — je krijgt het bedrag niet uitgekeerd, je betaalt minder belasting. Aftrek is pas mogelijk boven de drempel.",
  },
  {
    q: "Wat is de drempel in 2026?",
    a: "De drempel is het hoogste van: € 166 (zonder partner) of € 332 (met partner) als minimumdrempel, óf 1,65% van je drempelinkomen. Voor modale inkomens komt de drempel op ~€ 840 per jaar (1,65% × ~€ 51.000). Alleen kosten boven de drempel zijn aftrekbaar. Bron: Belastingdienst.",
  },
  {
    q: "Welke kosten tellen mee?",
    a: "Genees- en heelkundige hulp boven de basisverzekering (specialist, tandheelkundig boven dekking, fysio buiten basis), voorgeschreven medicijnen, hulpmiddelen (gehoorapparaat, prothese, steunzolen), vervoer voor doktersbezoek, dieet op doktersrecept, extra gezinshulp en extra kleding/beddengoed bij ziekte. Géén kosten die je zorgverzekering al vergoedt, géén eigen risico, géén premie zorgverzekering, géén alternatieve genezing zonder medische noodzaak.",
  },
  {
    q: "Is er een verhoging voor AOW-gerechtigden?",
    a: "Ja. AOW-gerechtigden met een drempelinkomen onder € 41.123 (2026) krijgen een verhoging van 113% van bepaalde aftrekposten. Bron: Belastingdienst. Bekijk in de aangifte zelf welke posten precies onder de verhoging vallen.",
  },
  {
    q: "Wat doet DeGeldHeld bij zorgkostenaftrek?",
    a: "We bieden een gratis indicatie-check op /zorgkosten-check: vul je drempelinkomen + verzamelde kosten in en we tonen of je waarschijnlijk boven of onder de drempel uitkomt. We doen géén aangifte voor je — voor het exacte bedrag rekent de Belastingdienst tijdens de aangifte. Geen DigiD nodig voor de check; je gegevens blijven in je browser.",
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
    { "@type": "ListItem", position: 2, name: "Zorgkostenaftrek aangifte 2026", item: `${APP_URL}${PAGE_PATH}` },
  ],
};

export default function ZorgkostenaftrekPage() {
  return (
    <>
      <SeoBreadcrumb trail={[{ label: "Zorgkostenaftrek aangifte 2026" }]} />
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
            Inkomstenbelasting · aangifte 2026
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Zorgkostenaftrek in je aangifte 2026
          </h1>
          <p className="mt-3 text-lg text-slate-700">
            Heb je in 2025 specifieke zorgkosten zelf betaald die de
            verzekering niet vergoedt? Dan kun je die in je aangifte 2026
            mogelijk aftrekken — maar pas <strong>boven de drempel</strong>.
            Die drempel is in 2026{" "}
            <strong>het hoogste van € 166 (€ 332 met partner) of
            1,65% van je drempelinkomen</strong>. Op deze pagina lees je
            de regels en doe je een gratis indicatie-check.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">
            Waar heb je recht op?
          </h2>
          <p className="mt-3 text-slate-700">
            De zorgkostenaftrek (specifieke zorgkosten) is een aftrekpost
            in box 1 van de inkomstenbelasting — geen toeslag. Je verlaagt
            je belastbaar inkomen, en betaalt daarmee minder belasting.
            Het verschil voor je portemonnee hangt af van je belastingschijf
            en het bedrag boven de drempel.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">
            Drempelbedrag 2026
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bron: Belastingdienst — drempelbedrag 2026.
          </p>
          {/* bron: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/hoe_berekent_u_uw_aftrek/drempelbedrag_berekenen/drempelbedrag-2026 */}
          {/* bron: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/hoe_berekent_u_uw_aftrek/drempelbedrag_berekenen/drempelbedrag-2025 */}
          <p className="mt-3 text-slate-700">
            <strong>Formule:</strong> drempel ={" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">
              max(minimum, 1,65% × drempelinkomen)
            </code>
            . Drempelinkomen = totaal inkomen in box 1 + 2 + 3 minus
            aftrekposten, vóór persoonsgebonden aftrek.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Jaar</th>
                  <th className="py-1 pr-3">Min. drempel (zonder partner)</th>
                  <th className="py-1 pr-3">Min. drempel (met partner)</th>
                  <th className="py-1">Bovengrens "lage inkomens"-verhoging</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr>
                  <td className="py-1 pr-3">2025</td>
                  <td className="py-1 pr-3">€ 164</td>
                  <td className="py-1 pr-3">€ 328</td>
                  <td className="py-1">€ 40.502 (113%-verhoging onder grens, AOW)</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-1 pr-3">2026</td>
                  <td className="py-1 pr-3">€ 166</td>
                  <td className="py-1 pr-3">€ 332 (2× per persoon)</td>
                  <td className="py-1">€ 41.123 (113%-verhoging onder grens, AOW)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Voor modale inkomens loopt de drempel op tot ongeveer <strong>€
            840</strong> (1,65% × ~€ 51.000). Alleen kosten <em>boven</em>{" "}
            die drempel zijn aftrekbaar.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Welke kosten tellen mee?
          </h2>
          <p className="mt-3 text-slate-700">
            Voor elke categorie geldt: <strong>medische noodzaak</strong>{" "}
            (vaak doktersrecept of medische verklaring). Géén exacte
            bedragen of forfaits hieronder — controleer het officiële
            Belastingdienst-overzicht per post.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-slate-700">
            <li>
              <strong>Genees- en heelkundige hulp</strong> — arts,
              specialist, paramedicus, tandarts boven basisverzekering,
              fysiotherapie buiten basis.
            </li>
            <li>
              <strong>Voorgeschreven medicijnen</strong> — inclusief
              homeopathisch op doktersrecept.
            </li>
            <li>
              <strong>Hulpmiddelen</strong> — gehoorapparaat, prothese,
              steunzolen, etc. die niet gratis door je zorgverzekeraar zijn
              verstrekt.
            </li>
            <li>
              <strong>Vervoer voor doktersbezoek/ziekenhuis</strong> — auto
              (kilometers × tarief) of OV.
            </li>
            <li>
              <strong>Reiskosten ziekenbezoek</strong> — als familie/partner
              een patiënt langer dan 10 dagen bezoekt op &gt; 10 km afstand.
            </li>
            <li>
              <strong>Dieet op doktersrecept</strong> — vaste forfaits per
              dieet, jaarlijks geactualiseerd door de Belastingdienst.
            </li>
            <li>
              <strong>Extra gezinshulp</strong> (wegens ziekte).
            </li>
            <li>
              <strong>Extra kleding en beddengoed</strong> (wegens ziekte —
              vaste forfaitaire bedragen).
            </li>
            <li>
              <strong>IVF-behandeling</strong> (boven de 3e poging).
            </li>
          </ul>

          <h3 className="mt-8 text-lg font-semibold text-slate-900">
            Wat telt NIET mee?
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-700">
            <li>Eigen risico zorgverzekering.</li>
            <li>Premie zorgverzekering (basis én aanvullend).</li>
            <li>Alternatieve genezing zonder medische noodzaak.</li>
            <li>Kosten die je zorgverzekeraar al heeft vergoed.</li>
            <li>Kosten waarvoor je gemeente-bijzondere bijstand kreeg.</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">
            Hoe vraag je het aan?
          </h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-slate-700">
            <li>
              <strong>Verzamel bewijsstukken</strong>: rekeningen,
              recepten, betaalbewijzen. Bewaar ze 5 jaar — de Belastingdienst
              kan ze opvragen.
            </li>
            <li>
              <strong>Bereken je drempel</strong>: max(€ 166 of € 332, 1,65%
              × drempelinkomen). Of doe onze gratis check op{" "}
              <Link href="/zorgkosten-check" className="text-brand-700 underline">
                /zorgkosten-check
              </Link>{" "}
              voor een snelle indicatie.
            </li>
            <li>
              <strong>Vul in tijdens je aangifte</strong> bij "Specifieke
              zorgkosten" (Belastingdienst aangifte 2026 — voor inkomstenjaar
              2025).
            </li>
            <li>
              <strong>Aangifte 2026 inkomstenjaar 2025</strong>: vanaf 1
              maart 2026 doe je aangifte over 2025 — daar gebruik je de
              2025-drempels. De 2026-drempels gelden voor de aangifte in
              2027.
            </li>
          </ol>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Let op:</strong> Aangifte 2026 = inkomstenjaar 2025 →
            gebruik de 2025-drempels (€ 164 / € 328). De 2026-drempels
            (€ 166 / € 332) gelden voor de aangifte die je in 2027 doet.
            Onze check stuurt je naar het juiste jaar.
          </p>
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
            Vul je drempelinkomen en verzamelde zorgkosten in en zie
            binnen 30 seconden of je waarschijnlijk over de drempel komt.
            Geen DigiD, geen registratie, alles rekent in je browser. We
            doen géén aangifte voor je.
          </p>
          <Link
            href="/zorgkosten-check"
            className="mt-5 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Naar de gratis zorgkosten-check →
          </Link>
        </section>

        <footer className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <strong>Indicatie, geen advies.</strong> De drempels en regels
          op deze pagina komen uit Belastingdienst-overzichten (drempelbedrag
          2025 + 2026). Welke specifieke zorgkosten in jouw geval wel of
          niet aftrekbaar zijn, blijft een aangifte-keuze die je in
          Mijn Belastingdienst maakt — of waarvoor je een belastingadviseur
          inschakelt. DeGeldHeld geeft{" "}
          <strong>geen fiscaal of financieel advies</strong> in de zin
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
