import Footer from "@/components/Footer";

export const metadata = {
  title: "Algemene voorwaarden",
  description:
    "De voorwaarden van DeGeldHeld: hoe het werkt, no-cure-no-pay fees, klant-aligned model, indicatie ≠ advies, AFM-uitsluiting, aansprakelijkheid en jurisdictie.",
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
            We ontvangen <strong>geen vergoeding van providers</strong>: geen
            kickbacks, geen affiliate, geen advertentiedeals, geen "voorkeurs-
            tarieven" in ruil voor verkeer. Onze omzet komt uitsluitend uit
            (a) <strong>klant-betaalde no-cure-no-pay-fees</strong> op bewezen
            besparing of teruggehaald geld, en (b) het <strong>Plus-
            abonnement</strong> dat je vrijwillig afsluit. Daarmee zijn onze
            belangen 100% aan jouw kant: minder kosten voor jou =
            meer omzet voor ons. We benoemen dit expliciet zodat je weet waarom
            een aanbeveling van ons komt.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            2. No-cure-no-pay fee &amp; mandaat — onderhandeling
          </h2>
          <p>
            Onze vergoeding op onderhandeling werkt op basis van{" "}
            <strong>no-cure-no-pay</strong>: je betaalt alleen wanneer een
            besparing is <strong>bewezen</strong> via een verifieerbaar
            bewijsstuk (forwarded e-mail, nieuwe factuur of screenshot).
          </p>
          <ul className="list-disc pl-6">
            <li>De fee is <strong>20% van de bewezen besparing op jaarbasis</strong>.</li>
            <li>We brengen pas iets in rekening boven een drempel van{" "}
              <strong>€ 25</strong> bewezen jaarbesparing.</li>
            <li>De fee is <strong>minimaal € 2</strong> en{" "}
              <strong>maximaal € 500</strong> per onderhandeling.</li>
            <li>Geen besparing = <strong>geen fee</strong>.</li>
            <li>
              <strong>Telecom (mobiel / internet / tv) — fee-integriteit:</strong>{" "}
              omdat NL-telecom retentie via de telefoon afhandelt en jij zelf
              het gesprek voert, brengen wij <strong>geen 20%-fee</strong> in
              rekening voor telecom-besparingen. Telecom is sinds versie 2.0
              een Plus-onderdeel (een jaarlijks vers retentie-belscript) i.p.v.
              een NCNP-categorie. Zie §3a.
            </li>
          </ul>
          <p>
            <strong>Betaalmandaat (off-session).</strong> Door akkoord te gaan
            machtig je DeGeldHeld om, via onze betaaldienstverlener (Stripe), de
            verschuldigde fee automatisch af te schrijven van je gekozen
            betaalmethode zodra een besparing is bevestigd. Je ontvangt vooraf
            een bevestiging met het bedrag. Je kunt dit mandaat op elk moment
            intrekken via je account of door een mail te sturen; intrekking laat
            reeds verschuldigde fees onverlet.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            2b. Onderhandelen namens jou (volmacht)
          </h2>
          <p>
            Optioneel kun je DeGeldHeld <strong>machtigen</strong> om{" "}
            <strong>namens jou</strong> met je provider te onderhandelen
            (volmacht, art. 3:60 BW). Deze machtiging is{" "}
            <strong>strikt beperkt tot onderhandelen en corresponderen</strong>:
            DeGeldHeld mag <strong>geen</strong> nieuw of gewijzigd contract
            namens jou accepteren of afsluiten — <strong>elk concreet aanbod of
            definitieve stap keur jij zelf goed</strong>. Je kunt de machtiging{" "}
            <strong>altijd intrekken</strong> (pauzeren/stoppen, art. 3:72 BW);
            daarna sturen we geen e-mails meer namens jou. Zonder machtiging
            blijft de gewone handmatige flow (jij verstuurt zelf) gelden. De
            volledige tekst staat in <em>docs/MACHTIGING.md</em> (concept — wordt
            juridisch getoetst).
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            2c. Aanvullende NCNP — Box 3-rechtsherstel (25%)
          </h2>
          <p>
            Voor het indienen van een Opgaaf Werkelijk Rendement (OWR) in het
            kader van de <strong>Wet tegenbewijsregeling Box 3</strong> bieden
            wij optioneel een aparte no-cure-no-pay-claim aan met de volgende
            voorwaarden:
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Drempel:</strong> we accepteren een Box 3-claim alléén als
              de <strong>verwachte teruggave ≥ € 500</strong>. Onder die
              drempel krijg je het <strong>DIY-pad gratis</strong>{" "}
              (concept-brief + checklist).
            </li>
            <li>
              <strong>Fee:</strong> <strong>25% van het werkelijk teruggehaalde
              bedrag</strong> (niet van de indicatie), <strong>gecapt op € 500
              per claim</strong>.
            </li>
            <li>
              <strong>Eerlijke uitkomst.</strong> Werkelijk teruggehaald
              bedrag &lt; € 500 → <strong>fee € 0</strong>, ook al was de
              indicatie hoger. We berekenen onze fee op wat er écht terug komt,
              niet op een schatting.
            </li>
            <li>
              <strong>Bewijs is leidend.</strong> Je uploadt de Belastingdienst-
              beschikking; we lezen het toegekende bedrag automatisch uit met
              OCR. Bij mislukte OCR doen we handmatige review — nooit een
              stille uitkering.
            </li>
            <li>
              <strong>Géén dunning.</strong> Lukt de Stripe-afschrijving niet
              (geen kaart op file, declined), dan zetten we de claim op FAILED
              en nemen we handmatig contact op — we draaien geen aanmaningen.
            </li>
            <li>
              <strong>2020-deadline al verstreken (31 dec 2025).</strong> Voor
              jaren 2017-2020 wijst de check je actief op het feit dat actie
              voor 2020 te laat is. Voor 2021-2024 geldt 1 mei 2026
              (zelf-indiener) / 1 oktober 2026 (via belastingadviseur).
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">
            3. Plus — abonnement
          </h2>
          <p>
            DeGeldHeld Plus is een optioneel maandabonnement (€ 4,99 – € 9,99
            per maand, opzegbaar elk moment) dat de gratis-checks aanvult met:
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Maandelijkse her-scan</strong> van geüploade rekeningen
              op nieuwe spookabonnementen of dubbele afschrijvingen (Vercel
              Cron, 1e van de maand).
            </li>
            <li>
              <strong>Status-tracking</strong> voor open Box 3-claims tot de
              Belastingdienst-beschikking binnen is.
            </li>
            <li>
              <strong>Kwartaal-reminders</strong> voor de toeslagen- en
              zorgkosten-checks (vragenlijst — je inkomensdata blijft
              client-side).
            </li>
            <li>
              <strong>Alerts</strong>: contract-einde, prijsstijging, grens-
              wijziging.
            </li>
            <li>
              <strong>NS-deadline-reminders</strong> voor compensatie-claims
              (claim zelf dien je in via Mijn NS).
            </li>
            <li>
              <strong>Telecom-belscript</strong> (zie §3a): jaarlijks vers
              retentie-belscript per provider.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">
            3a. Telecom-belscript (Plus)
          </h2>
          <p>
            NL-telecom (KPN / Vodafone / Odido / Ziggo) doet retentie
            standaard <strong>via de telefoon</strong> en niet via een
            onderhandel-mail. Een 20%-NCNP-fee op een gesprek dat jij zelf
            voert is ethisch niet zuiver; daarom is telecom géén NCNP-categorie
            (zie §2 laatste opsommingsregel). In plaats daarvan leveren we via
            Plus elk jaar een vers, op jouw situatie afgestemd retentie-
            belscript — als concept-script + actuele alternatieve
            aanbiedingen. Of het gesprek slaagt hangt af van jouw inzet en de
            provider; wij geven geen besparingsgarantie en sturen geen fee na.
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
            We doen ons best om accurate analyses en goede onderhandeltekst te
            leveren, maar kunnen niet garanderen dat je provider akkoord gaat.
            Onze aansprakelijkheid is beperkt tot het door jou betaalde bedrag
            in de afgelopen 12 maanden. We zijn niet aansprakelijk voor
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
                <td className="py-1">Luchtvaartmaatschappij — claim via hun formulier of via no-cure-no-pay-bureau</td>
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
