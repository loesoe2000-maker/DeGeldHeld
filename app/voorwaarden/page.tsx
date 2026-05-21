import Footer from "@/components/Footer";

export const metadata = {
  title: "Algemene voorwaarden",
  description:
    "De voorwaarden van DeGeldHeld: hoe het werkt, no-cure-no-pay fee, aansprakelijkheid, opzegging en jurisdictie.",
};

export default function VoorwaardenPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800">
        <h1 className="text-4xl font-bold text-slate-900">Algemene voorwaarden</h1>
        <p className="mt-2 text-sm text-slate-500">
          Versie 1.0 — {new Date().toLocaleDateString("nl-NL", {
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
            vergelijken (telecom, energie, water, abonnementen). We stellen met
            behulp van AI namens jou een onderhandel-e-mail op; <em>jij</em>
            verstuurt die zelf vanuit je eigen mailbox. Dit is{" "}
            <strong>geen financieel advies</strong> in de zin van de Wft.{" "}
            <strong>Hypotheek en verzekering bieden we niet aan</strong> — dat
            zijn financiële producten waarvoor een AFM-vergunning nodig is.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">2. No-cure-no-pay fee &amp; mandaat</h2>
          <p>
            Onze vergoeding werkt op basis van <strong>no-cure-no-pay</strong>:
            je betaalt alleen wanneer een besparing is <strong>bewezen</strong>.
          </p>
          <ul className="list-disc pl-6">
            <li>De fee is <strong>20% van de bewezen besparing op jaarbasis</strong>.</li>
            <li>We brengen pas iets in rekening boven een drempel van{" "}
              <strong>€ 25</strong> bewezen jaarbesparing.</li>
            <li>De fee is <strong>minimaal € 2</strong> en{" "}
              <strong>maximaal € 500</strong> per onderhandeling.</li>
            <li>Geen besparing = <strong>geen fee</strong>.</li>
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

          <h2 className="text-2xl font-semibold text-slate-900">3. Jouw verantwoordelijkheden</h2>
          <ul className="list-disc pl-6">
            <li>Je uploadt rekeningen die op jouw naam staan.</li>
            <li>Je verstuurt de gegenereerde e-mail zelf en bevestigt later de uitkomst.</li>
            <li>Je deelt geen accountgegevens en gebruikt de dienst niet voor automatisering of resale.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">4. Aansprakelijkheid</h2>
          <p>
            We doen ons best om accurate analyses en goede onderhandeltekst te
            leveren, maar kunnen niet garanderen dat je provider akkoord gaat.
            Onze aansprakelijkheid is beperkt tot het door jou betaalde bedrag
            in de afgelopen 12 maanden. We zijn niet aansprakelijk voor
            indirecte schade (gemiste besparing, bedrijfsschade, gevolgschade).
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">5. Geen financieel advies, geen besparingsgarantie</h2>
          <p>
            DeGeldHeld geeft <strong>geen financieel of juridisch advies</strong>{" "}
            in de zin van de Wft. We helpen je je bestaande contracten te
            onderhandelen/vergelijken; onze suggesties zijn algemeen en je
            beoordeelt zelf wat past bij jouw situatie. We{" "}
            <strong>garanderen geen besparing</strong> — of je provider akkoord
            gaat, ligt buiten onze macht. Hypotheek- en verzekeringsadvies
            (Wft-producten) bieden we niet aan.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">6. Opzegging en account verwijderen</h2>
          <p>
            Je kunt je account altijd verwijderen door een mail naar{" "}
            <a className="text-brand-700 underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>
            . Lopende onderhandelingen blijven 30 dagen toegankelijk.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">7. Wijzigingen</h2>
          <p>
            We mogen deze voorwaarden aanpassen. Bij materiële wijzigingen
            mailen we je vooraf. Door de dienst te blijven gebruiken na de
            ingangsdatum, accepteer je de nieuwe versie.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">8. Toepasselijk recht</h2>
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
