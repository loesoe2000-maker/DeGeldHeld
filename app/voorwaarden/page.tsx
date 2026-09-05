import Footer from "@/components/Footer";

export const metadata = {
  title: "Algemene voorwaarden",
  description:
    "De voorwaarden van DeGeldHeld: hoe het werkt, waarom het gratis is, kosten van derden, indicatie ≠ advies, AFM-uitsluiting, aansprakelijkheid en jurisdictie.",
};

export default function VoorwaardenPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800">
        <h1 className="text-4xl font-bold text-slate-900">Algemene voorwaarden</h1>
        <p className="mt-2 text-sm text-slate-500">
          Versie 2.0 — {new Date().toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        {/* CONCEPT — laat door een jurist controleren vóór productie. Dit is
            geen juridisch advies. */}
        <section className="prose mt-10 max-w-none space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">1. Wat we doen</h2>
          <p>
            DeGeldHeld is een consumentendienst die je helpt je{" "}
            <strong>bestaande contracten</strong> te onderhandelen en
            vergelijken (energie, bankpakketten, software- en overige
            abonnementen). We stellen met behulp van AI namens jou een
            onderhandel-e-mail op die we (na expliciete machtiging) namens jou
            versturen, of die jij zelf vanuit je mailbox verstuurt.
          </p>
          <p>
            Daarnaast bieden we <strong>gratis indicatie-checks</strong> voor
            toeslagen + gemeente-regelingen, Box 3-rechtsherstel, NS Geld-Terug
            bij Vertraging, zorgkostenaftrek, vluchtcompensatie (EU261) en
            spookabonnementen. Zie §9 voor de "indicatie ≠ advies"-passage per
            check.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            1b. Wat we NIET zijn (Wft / AFM-uitsluiting)
          </h2>
          <p>
            DeGeldHeld is <strong>geen financieel adviseur</strong> in de zin
            van de Wet op het financieel toezicht (Wft) en is niet door de AFM
            vergund voor advies of bemiddeling in financiële producten. Daarom
            bieden wij <strong>geen hypotheek</strong>, <strong>geen
            verzekering</strong> en <strong>geen beleggings- of
            pensioenadvies</strong> aan. Onze tools en checks bevatten waar
            relevant een verwijzing naar de officiële Belastingdienst-,
            Rijksoverheid- of Nibud-pagina's voor de exacte berekening of
            aanvraag.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            1c. Klant-aligned — geen providergeld (model B)
          </h2>
          <p>
            DeGeldHeld is <strong>gratis</strong>. We brengen je niets in
            rekening: geen fee, geen percentage, geen abonnement. En we
            ontvangen <strong>geen vergoeding van providers</strong>: geen
            kickbacks, geen affiliate, geen advertentiedeals, geen
            &quot;voorkeurstarieven&quot; in ruil voor verkeer. Er is dus
            niemand wiens belang boven het jouwe gaat. We benoemen dit
            expliciet zodat je weet waarom een aanbeveling van ons komt.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            2. Kosten — van ons niets, van derden soms wel
          </h2>
          <p>
            Het gebruik van DeGeldHeld kost je <strong>niets</strong>. Er is
            geen fee, geen percentage over wat je terugkrijgt, geen abonnement
            en geen betaald vervolg. Geld dat je terugkrijgt gaat rechtstreeks
            van de instantie of je provider naar jou; wij zitten daar niet
            tussen en beheren nooit jouw geld.
          </p>
          <p>
            <strong>Wat wél geld kan kosten, zijn de officiële procedures
            zelf.</strong> Die kosten betaal je aan die instantie, niet aan
            ons:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Huurcommissie</strong> — € 25 leges per procedure. Je
              krijgt dit terug als je in het gelijk wordt gesteld.
            </li>
            <li>
              <strong>Geschillencommissie Energie</strong> — € 27,50 leges plus
              € 52,50 klachtgeld. Ook dit krijg je bij winst terug.
            </li>
          </ul>
          <p>
            Deze bedragen worden door de betreffende instantie vastgesteld en
            kunnen wijzigen. We noemen ze bij de betreffende check, zodat je
            vooraf weet waar je aan begint.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            3. Wat je van ons mag verwachten
          </h2>
          <p>
            We bereiden je claim of bezwaar voor en leveren een brief die je
            zelf indient. <strong>Jij dient in en houdt de regie</strong> — wij
            treden niet namens jou op bij een instantie, tenzij je daar apart
            en uitdrukkelijk toestemming voor geeft. Omdat de dienst gratis is,
            geldt er geen resultaatsverplichting: we doen ons best, maar
            garanderen geen uitkomst.
          </p>

                    <h2 className="text-2xl font-semibold text-slate-900">
            4. Jouw verantwoordelijkheden
          </h2>
          <ul className="list-disc pl-6">
            <li>Je uploadt rekeningen die op jouw naam staan.</li>
            <li>Je verstuurt de gegenereerde e-mail zelf, óf machtigt ons om dat namens jou te doen (zie §2b), en bevestigt later de uitkomst.</li>
            <li>Voor Box 3-claims upload je de Belastingdienst-beschikking zoals die door MijnBelastingdienst is uitgegeven.</li>
            <li>Je deelt geen accountgegevens en gebruikt de dienst niet voor automatisering of resale.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">
            5. Aansprakelijkheid
          </h2>
          <p>
            We doen ons best om accurate analyses en goede brieven te leveren,
            maar kunnen niet garanderen dat een instantie of provider akkoord
            gaat. Omdat de dienst gratis is, is onze aansprakelijkheid beperkt
            tot <strong>€ 500 per gebeurtenis</strong>. We kiezen bewust voor
            een bedrag en niet voor &quot;het door jou betaalde bedrag&quot;:
            dat laatste zou bij een gratis dienst neerkomen op een volledige
            uitsluiting, en een volledige uitsluiting is naar Nederlands recht
            vaak niet houdbaar. Deze beperking geldt niet bij opzet of bewuste
            roekeloosheid van onze kant. We zijn niet aansprakelijk voor
            indirecte schade (gemiste besparing, bedrijfsschade, gevolgschade).
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            6. Geen financieel/fiscaal advies, geen besparingsgarantie
          </h2>
          <p>
            DeGeldHeld geeft <strong>geen financieel, fiscaal of juridisch
            advies</strong> in de zin van de Wft of de gedrags-/beroepsregels
            van een belastingadviseur (NOB/RB). We helpen je je bestaande
            contracten te onderhandelen/vergelijken en bieden{" "}
            <strong>indicatie-tools</strong> voor toeslagen, Box 3, NS,
            zorgkosten en EU261; onze suggesties zijn algemeen en je beoordeelt
            zelf wat past bij jouw situatie. We <strong>garanderen geen
            besparing</strong> en <strong>geen uitkering</strong> — of de
            wederpartij (provider, Belastingdienst, luchtvaartmaatschappij, NS)
            akkoord gaat, ligt buiten onze macht. Hypotheek- en
            verzekeringsadvies (Wft-producten) bieden we niet aan (zie §1b).
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            7. Opzegging en account verwijderen
          </h2>
          <p>
            Je kunt je account altijd verwijderen door een mail naar{" "}
            <a className="text-brand-700 underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>
            . Lopende onderhandelingen blijven 30 dagen toegankelijk. Box 3-
            claims en betaalbewijzen worden bij accountverwijdering
            gepseudonimiseerd maar 7 jaar bewaard vanwege de wettelijke
            bewaarplicht voor financiële administratie (art. 52 lid 4 AWR) —
            zie de privacyverklaring.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            8. Wijzigingen
          </h2>
          <p>
            We mogen deze voorwaarden aanpassen. Bij materiële wijzigingen
            mailen we je vooraf. Door de dienst te blijven gebruiken na de
            ingangsdatum, accepteer je de nieuwe versie.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            9. Indicatie ≠ advies — per check
          </h2>
          <p>
            Onze gratis-checks geven een <strong>indicatie</strong> op basis
            van publiek gemaakte regels en bedragen. Een indicatie is
            <em> géén</em> definitief recht, <em>geen</em> bindend bedrag, en
            <em> géén</em> advies. De uiteindelijke beoordeling ligt altijd bij
            de officiële instantie (Belastingdienst, gemeente, NS,
            luchtvaartmaatschappij of rechtbank).
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-1 pr-3">Check</th>
                <th className="py-1 pr-3">Wat we tonen</th>
                <th className="py-1">Officiële instantie</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr>
                <td className="py-1 pr-3"><strong>Zorgtoeslag</strong></td>
                <td className="py-1 pr-3">Bovengrens-indicatie op 2026-grenzen (inkomen + vermogen + leeftijd)</td>
                <td className="py-1">Belastingdienst — exact bedrag via proefberekening</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Huurtoeslag</strong></td>
                <td className="py-1 pr-3">"Mogelijk recht" — geen eigen bedrag (complexe formule + 2026-aftopping)</td>
                <td className="py-1">Belastingdienst — proefberekening + aanvraag</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Kindgebonden budget</strong></td>
                <td className="py-1 pr-3">Bovengrens-indicatie op 2026-bedragen per kind + ALO-kop</td>
                <td className="py-1">Belastingdienst — proefberekening</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Gemeente-regelingen</strong></td>
                <td className="py-1 pr-3">Verwijzing — wij gokken geen per-gemeente-bedragen</td>
                <td className="py-1">Je gemeente + Nibud "Bereken je Recht"</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Box 3-rechtsherstel</strong></td>
                <td className="py-1 pr-3">Indicatie verwachte teruggave op sourced forfaits 2017-2026</td>
                <td className="py-1">Belastingdienst — OWR-formulier in MijnBelastingdienst</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>NS Geld-Terug</strong></td>
                <td className="py-1 pr-3">Indicatie compensatie volgens NS-voorwaarden / EU-PRR 2021/782</td>
                <td className="py-1">NS — claim via Mijn NS / ns.nl-formulier</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Zorgkostenaftrek</strong></td>
                <td className="py-1 pr-3">Drempel + indicatie aftrekbaar bedrag. <strong>Géén</strong> exact belastingvoordeel (= aftrek × marginaal tarief)</td>
                <td className="py-1">Belastingdienst — opgeven bij aangifte</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>EU261-vluchtcompensatie</strong></td>
                <td className="py-1 pr-3">Indicatie € 250 / € 400 / € 600 op basis van afstand + vertraging (Verordening 261/2004)</td>
                <td className="py-1">Luchtvaartmaatschappij — claim via hun formulier, of via een extern claimbureau (niet DeGeldHeld; die rekenen wél een percentage)</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-slate-600">
            Onze data-bron is gedocumenteerd in <em>docs/BENEFITS_DATA_2026.md</em>{" "}
            en <em>docs/V29_DATA_2026.md</em> (Belastingdienst, Rijksoverheid,
            NS, EU-Lex, Hoge Raad). Elk getal heeft een verifieerbare bron met
            peildatum 2026. Bij verschil tussen aggregator en officiële bron
            wint de officiële bron.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            10. Toepasselijk recht
          </h2>
          <p>
            Op deze voorwaarden is Nederlands recht van toepassing. Geschillen
            worden voorgelegd aan de bevoegde rechter in Amsterdam, tenzij
            dwingend recht anders bepaalt.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
