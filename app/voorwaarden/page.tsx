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

        <section className="prose mt-10 max-w-none space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">1. Wat we doen</h2>
          <p>
            DeGeldHeld is een consumentendienst die met behulp van AI namens
            jou een onderhandelings-e-mail opstelt voor je provider (telecom,
            energie, verzekering, abonnement). Wij <em>versturen</em> de
            e-mail niet automatisch — je verstuurt zelf vanuit je eigen
            mailbox. Wij geven advies, geen juridisch of financieel advies.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">2. No-cure-no-pay fee</h2>
          <p>
            De eerste onderhandeling is gratis. Voor elke volgende
            onderhandeling betaal je een vast bedrag van € 4,99 per dossier.
            Mocht je later geen besparing realiseren, dan vergoeden we het
            bedrag <strong>niet</strong> — de kosten zitten in de AI-analyse
            en de gegenereerde e-mail, niet in een succesbelofte.
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

          <h2 className="text-2xl font-semibold text-slate-900">5. Geen financieel advies</h2>
          <p>
            DeGeldHeld geeft geen financieel of juridisch advies in de zin van
            de Wft. Onze suggesties zijn algemeen en moeten door jou
            beoordeeld worden voor jouw persoonlijke situatie.
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
