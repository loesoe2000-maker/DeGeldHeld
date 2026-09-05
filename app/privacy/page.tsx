import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacyverklaring",
  description:
    "Hoe DeGeldHeld omgaat met je gegevens onder de AVG: welke data, met welk doel en grondslag, met welke verwerkers, bewaartermijnen en jouw rechten.",
};

{/* CONCEPT — laat door een jurist/DPO controleren vóór productie. Dit is
    geen juridisch advies. */}

export default function PrivacyPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800">
        <h1 className="text-4xl font-bold text-slate-900">Privacyverklaring</h1>
        <p className="mt-2 text-sm text-slate-500">
          Laatst bijgewerkt:{" "}
          {new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <section className="prose mt-10 max-w-none space-y-6">
          <p>
            DeGeldHeld helpt je je vaste lasten te verlagen door je facturen te
            analyseren en namens jou een onderhandel-mail op te stellen. Daarnaast
            bieden we sinds 2026 een aantal <strong>gratis indicatie-checks</strong>{" "}
            (toeslagen + gemeente-regelingen, Box 3-rechtsherstel, NS Geld-Terug
            bij Vertraging, zorgkostenaftrek, vluchtclaim, spookabonnementen) plus
            optioneel hulp bij een Box 3-claim. Voor al
            deze functies houden we ons aan de Algemene Verordening
            Gegevensbescherming (AVG). Hieronder lees je precies wat we
            verwerken, waarom, op welke grondslag, met wie we delen, hoe lang we
            bewaren en welke rechten je hebt.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">1. Wie we zijn</h2>
          <p>
            Techz B.V., handelend onder de naam DeGeldHeld
            (verwerkingsverantwoordelijke), gevestigd in Nederland, KvK
            84079398. Vragen of AVG-verzoeken:{" "}
            <a className="text-brand-700 underline" href="mailto:privacy@degeldheld.com">
              privacy@degeldheld.com
            </a>
            . We hebben (nog) geen verplichte Functionaris Gegevensbescherming
            aangesteld; je kunt voor privacyvragen bij bovenstaand adres terecht.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">
            2. Client-side checks — wat je browser niet verlaat
          </h2>
          <p>
            Privacy-by-design is voor ons structureel, niet cosmetisch. De
            volgende checks rekenen <strong>volledig in je eigen browser</strong>;
            je inkomens-, vermogens-, zorgkosten- of vluchtdata wordt{" "}
            <strong>niet</strong> naar onze servers verstuurd en niet opgeslagen:
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Geld-check</strong> (toeslagen + gemeente-regelingen, op{" "}
              <em>/geld-check</em>) — alle invoer (inkomen, vermogen, huur,
              kinderen, postcode) blijft client-side.
            </li>
            <li>
              <strong>Box 3-check</strong> (op <em>/box3-check</em>) — banktegoeden,
              overige bezittingen, schulden en werkelijk rendement blijven
              client-side. Pas wanneer je expliciet kiest voor de begeleide
              vervolg-claim slaan we een <em>Box3Claim</em>-record op (zie §3 en §5).
            </li>
            <li>
              <strong>Zorgkosten-check</strong> (op <em>/zorgkosten-check</em>) —
              drempelinkomen + zorgkosten per categorie blijven client-side.
            </li>
            <li>
              <strong>NS-check</strong> (op <em>/ns-check</em>) — ticketprijs,
              vertraging, route en datum blijven client-side.
            </li>
            <li>
              <strong>Vluchtclaim-check</strong> (op <em>/vluchtclaim</em>) —
              vluchtnummer en datum worden alleen doorgegeven aan onze flight-data-
              provider als jij op "check" klikt; we slaan ze niet op.
            </li>
          </ul>
          <p className="text-sm text-slate-600">
            Analytics-events bevatten <strong>geen</strong> persoonsgegevens uit
            deze checks — alleen geanonimiseerde booleans/counts (bv. "check
            gestart", "resultaat bekeken", aantal kinderen).
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">3. Welke gegevens, met welk doel en grondslag</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-1 pr-3">Gegevens</th>
                <th className="py-1 pr-3">Doel</th>
                <th className="py-1">Grondslag</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr>
                <td className="py-1 pr-3"><strong>E-mailadres</strong> (+ login-sessie)</td>
                <td className="py-1 pr-3">Account, inloggen via magic-link, je het resultaat sturen</td>
                <td className="py-1">Uitvoering overeenkomst</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Factuurgegevens</strong> (geüpload beeld/PDF + uitgelezen velden: provider, abonnement, bedrag, klantnummer)</td>
                <td className="py-1 pr-3">De markt vergelijken + onderhandel-mail opstellen</td>
                <td className="py-1">Uitvoering overeenkomst</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Onderhandel-data</strong> (gegenereerde mail, status, bespaarde bedragen, bewijs)</td>
                <td className="py-1 pr-3">De dienst leveren</td>
                <td className="py-1">Uitvoering overeenkomst</td>
              </tr>
              <tr>
                <td className="py-1 pr-3">
                  <strong>Box 3-claim + geüploade Belastingdienst-beschikking</strong>
                  {" "}(belastingjaar, indicatieve verwachte teruggave, status-historie,
                  werkelijk teruggehaald bedrag uit OCR, fee-bedrag, Stripe-payment-id)
                </td>
                <td className="py-1 pr-3">
                  Het teruggehaalde bedrag vastleggen via OCR van je
                  Belastingdienst-beschikking; financiële administratie voeren
                </td>
                <td className="py-1">
                  Uitvoering overeenkomst (art. 6 lid 1b AVG) + wettelijke
                  bewaarplicht financiële administratie (7 jaar)
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-3">
                  <strong>Plus her-scan snapshots</strong> (per maand: lijst van
                  spookabonnementen + open Box 3-claims; géén inhoud van de
                  beschikking, géén check-input)
                </td>
                <td className="py-1 pr-3">
                  Maandelijkse her-scan vergelijken met de vorige run zodat we je
                  alleen mailen áls er iets verandert
                </td>
                <td className="py-1">
                  Uitvoering overeenkomst
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Betaalgegevens</strong> (via Stripe; wij zien status + laatste 4 cijfers)</td>
                <td className="py-1 pr-3">Betaling van de fee / abonnement afhandelen</td>
                <td className="py-1">Uitvoering overeenkomst + wettelijke plicht (fiscaal)</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Technische gegevens</strong> (IP, browser, foutmeldingen — cookies/auth-headers gestript)</td>
                <td className="py-1 pr-3">Beveiliging, misbruik tegengaan, fouten opsporen</td>
                <td className="py-1">Gerechtvaardigd belang</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>AI-trainingsdata</strong> (geanonimiseerde factuurvelden)</td>
                <td className="py-1 pr-3">OCR verbeteren — alleen met jouw expliciete opt-in</td>
                <td className="py-1">Toestemming</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Bespaar-tips &amp; herinneringen</strong> (retentie-mails)</td>
                <td className="py-1 pr-3">Je wijzen op nieuwe besparingen</td>
                <td className="py-1">Gerechtvaardigd belang — met opt-out in elke mail</td>
              </tr>
              <tr>
                <td className="py-1 pr-3"><strong>Onderhandelen namens jou</strong> (naam, klantnummer, factuurcontext → je provider)</td>
                <td className="py-1 pr-3">Namens jou onderhandelen — alleen na expliciete machtiging</td>
                <td className="py-1">Uitvoering overeenkomst + toestemming (machtiging)</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-slate-600">
            Als je DeGeldHeld machtigt om namens jou te onderhandelen (volmacht,
            zie de voorwaarden), sturen we onderhandel-e-mails met je naam +
            klantnummer naar de betreffende <strong>provider</strong>. Dat
            gebeurt alleen voor de provider waarvoor je de machtiging geeft, en
            je kunt 'm altijd intrekken.
          </p>
          <p className="text-sm text-slate-600">
            <strong>Box 3-claim — toelichting.</strong> Voor de begeleide 
            fee op Box 3-rechtsherstel verwerken wij <strong>wel</strong> jouw
            <em> Box3Claim</em>-record en de geüploade Belastingdienst-
            beschikking (PDF). Dit is noodzakelijk voor (a) het deterministisch
            berekenen + afschrijven van onze 25%-fee via Stripe en (b) de
            wettelijke bewaarplicht voor financiële administratie. De grondslag
            is <strong>artikel 6 lid 1b AVG</strong> (<em>noodzakelijk voor de
            uitvoering van de overeenkomst</em>). Andere check-inputs (vermogen,
            inkomen, forfaits) blijven uitsluitend client-side. Zonder begeleide 
            keuze (DIY-pad) slaan we niets op.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">4. Met wie we delen (sub-verwerkers)</h2>
          <p>Om de dienst te leveren schakelen we deze verwerkers in. Met elk sluiten we een verwerkersovereenkomst (DPA).</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-1 pr-3">Verwerker</th>
                <th className="py-1 pr-3">Verwerkt</th>
                <th className="py-1">Locatie</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr><td className="py-1 pr-3"><strong>Vercel</strong></td><td className="py-1 pr-3">Hosting van de applicatie + Vercel Cron (Plus maandelijkse her-scan) + opslag geüploade Box 3-beschikking</td><td className="py-1">EU (fra1) / VS-moederbedrijf</td></tr>
              <tr><td className="py-1 pr-3"><strong>Neon</strong></td><td className="py-1 pr-3">Database (account, facturen, onderhandelingen, Box 3-claims, Plus-her-scan-snapshots)</td><td className="py-1">EU (Frankfurt)</td></tr>
              <tr><td className="py-1 pr-3"><strong>Resend</strong></td><td className="py-1 pr-3">Transactionele + retentie-e-mail + maandelijkse Plus-her-scan-mail</td><td className="py-1">EU / VS</td></tr>
              <tr><td className="py-1 pr-3"><strong>Groq</strong></td><td className="py-1 pr-3">AI/OCR-analyse van je factuur en (bij een Box 3-claim) van de Belastingdienst-beschikking</td><td className="py-1">VS</td></tr>
              <tr><td className="py-1 pr-3"><strong>Stripe</strong></td><td className="py-1 pr-3">Historische betaalgegevens. Sinds v41 is DeGeldHeld gratis en vinden er geen betalingen meer plaats; de koppeling blijft alleen bestaan voor oude records.</td><td className="py-1">EU / VS</td></tr>
              <tr><td className="py-1 pr-3"><strong>Aviation Edge / AviationStack</strong> (alleen bij vluchtclaim, achter <em>FEATURE_CLAIMS</em>)</td><td className="py-1 pr-3">Vluchtnummer + datum opzoeken om EU261-vertraging te bepalen</td><td className="py-1">EU / VS — afhankelijk van gekozen provider</td></tr>
              <tr><td className="py-1 pr-3"><strong>Cloudflare</strong></td><td className="py-1 pr-3">DNS, CDN, bot-bescherming (Turnstile)</td><td className="py-1">EU / VS (edge)</td></tr>
              <tr><td className="py-1 pr-3"><strong>Sentry</strong></td><td className="py-1 pr-3">Foutmonitoring (PII gestript)</td><td className="py-1">EU / VS</td></tr>
              <tr><td className="py-1 pr-3"><strong>PostHog</strong></td><td className="py-1 pr-3">Anonieme funnel-analytics (geen factuurdata, geen client-side-check-input; financiële elementen gemaskeerd, cookieloos)</td><td className="py-1">EU (eu.i.posthog.com)</td></tr>
            </tbody>
          </table>
          <p>
            Voor verwerkers met (mogelijke) verwerking buiten de EU steunen we op
            de EU-standaardcontractbepalingen (SCC's). MailerLite (los van de app)
            kan voor marketing-nieuwsbrieven worden gebruikt; daarvoor geldt
            altijd een aparte opt-in.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">5. Hoe lang we bewaren</h2>
          <ul className="list-disc pl-6">
            <li>Accountgegevens: zolang je account bestaat.</li>
            <li>Facturen + analyses: zolang je account actief is; je kunt ze zelf verwijderen via <strong>/account</strong>.</li>
            <li><strong>Anonieme uploads</strong> (vóór signup): automatisch verwijderd na <strong>24 uur</strong> als ze niet aan een account gekoppeld worden (dagelijkse opschoon-cron).</li>
            <li>
              <strong>Box 3-claim + geüploade Belastingdienst-beschikking:</strong>{" "}
              <strong>7 jaar</strong> vanaf de afronding van de claim — vereist
              door de wettelijke bewaarplicht voor financiële administratie
              (art. 52 lid 4 AWR). Daarna onomkeerbaar verwijderd.
            </li>
            <li>
              <strong>Her-scan snapshots:</strong> zolang je account
              actief is — voor de diff-berekening tussen maandelijkse runs.
              Verwijderd binnen 30 dagen na opzegging.
            </li>
            <li>Betaalgegevens/-bewijs: 7 jaar (wettelijke fiscale bewaarplicht).</li>
            <li>Foutmeldingen (Sentry): kortlopend, in beginsel 30 dagen.</li>
            <li>Bij accountverwijdering anonimiseren we onomkeerbaar (geen e-mail, naam, klantnummer of factuurtekst meer). Box 3-claims en betaalbewijzen worden gepseudonimiseerd maar 7 jaar bewaard wegens fiscale plicht.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">6. Cookies</h2>
          <p>
            Alleen functionele/noodzakelijke cookies (sessie, voorkeuren,
            bot-bescherming via Cloudflare Turnstile). Geen tracking- of
            advertentiecookies.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">7. Jouw rechten</h2>
          <p>
            Je hebt recht op inzage, correctie, verwijdering, beperking,
            dataportabiliteit en bezwaar. Een groot deel regel je zelf op{" "}
            <a className="text-brand-700 underline" href="/account">/account</a>:
            je <strong>data downloaden</strong> (export, AVG art. 20) en je{" "}
            <strong>account verwijderen</strong> (AVG art. 17). Overige verzoeken:{" "}
            <a className="text-brand-700 underline" href="mailto:privacy@degeldheld.com">
              privacy@degeldheld.com
            </a>{" "}
            — we reageren binnen 30 dagen. Klagen kan ook bij de Autoriteit
            Persoonsgegevens.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">8. Beveiliging</h2>
          <p>
            HTTPS, encryptie in transit en at-rest, role-based toegang tot de
            database, rate-limiting tegen misbruik, security-headers en
            ondertekende (Svix) webhooks. Een datalek behandelen we volgens ons
            interne datalek-protocol (melding bij de AP binnen 72 uur indien
            vereist).
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">9. Wijzigingen</h2>
          <p>
            Bij materiële wijzigingen informeren we je vooraf. Kleine updates
            publiceren we hier met een nieuwe datum.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
