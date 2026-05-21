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
            analyseren en namens jou een onderhandel-mail op te stellen. Daarvoor
            verwerken we persoonsgegevens. We houden ons aan de Algemene
            Verordening Gegevensbescherming (AVG). Hieronder lees je precies wat
            we verwerken, waarom, op welke grondslag, met wie we delen, hoe lang
            we bewaren en welke rechten je hebt.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">1. Wie we zijn</h2>
          <p>
            DeGeldHeld B.V. (verwerkingsverantwoordelijke), gevestigd in
            Nederland, KvK 00000000. Vragen of AVG-verzoeken:{" "}
            <a className="text-brand-700 underline" href="mailto:privacy@degeldheld.com">
              privacy@degeldheld.com
            </a>
            . We hebben (nog) geen verplichte Functionaris Gegevensbescherming
            aangesteld; je kunt voor privacyvragen bij bovenstaand adres terecht.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">2. Welke gegevens, met welk doel en grondslag</h2>
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
                <td className="py-1 pr-3">De dienst leveren + (bij no-cure-no-pay) de fee bepalen</td>
                <td className="py-1">Uitvoering overeenkomst</td>
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

          <h2 className="text-2xl font-semibold text-slate-900">3. Met wie we delen (sub-verwerkers)</h2>
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
              <tr><td className="py-1 pr-3"><strong>Vercel</strong></td><td className="py-1 pr-3">Hosting van de applicatie</td><td className="py-1">EU (fra1) / VS-moederbedrijf</td></tr>
              <tr><td className="py-1 pr-3"><strong>Neon</strong></td><td className="py-1 pr-3">Database (account, facturen, onderhandelingen)</td><td className="py-1">EU (Frankfurt)</td></tr>
              <tr><td className="py-1 pr-3"><strong>Resend</strong></td><td className="py-1 pr-3">Transactionele + retentie-e-mail</td><td className="py-1">EU / VS</td></tr>
              <tr><td className="py-1 pr-3"><strong>Groq</strong></td><td className="py-1 pr-3">AI/OCR-analyse van je factuur</td><td className="py-1">VS</td></tr>
              <tr><td className="py-1 pr-3"><strong>Stripe</strong></td><td className="py-1 pr-3">Betalingen</td><td className="py-1">EU / VS</td></tr>
              <tr><td className="py-1 pr-3"><strong>Cloudflare</strong></td><td className="py-1 pr-3">DNS, CDN, bot-bescherming (Turnstile)</td><td className="py-1">EU / VS (edge)</td></tr>
              <tr><td className="py-1 pr-3"><strong>Sentry</strong></td><td className="py-1 pr-3">Foutmonitoring (PII gestript)</td><td className="py-1">EU / VS</td></tr>
            </tbody>
          </table>
          <p>
            Voor verwerkers met (mogelijke) verwerking buiten de EU steunen we op
            de EU-standaardcontractbepalingen (SCC's). MailerLite (los van de app)
            kan voor marketing-nieuwsbrieven worden gebruikt; daarvoor geldt
            altijd een aparte opt-in.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">4. Hoe lang we bewaren</h2>
          <ul className="list-disc pl-6">
            <li>Accountgegevens: zolang je account bestaat.</li>
            <li>Facturen + analyses: zolang je account actief is; je kunt ze zelf verwijderen via <strong>/account</strong>.</li>
            <li><strong>Anonieme uploads</strong> (vóór signup): automatisch verwijderd na <strong>24 uur</strong> als ze niet aan een account gekoppeld worden (dagelijkse opschoon-cron).</li>
            <li>Betaalgegevens/-bewijs: 7 jaar (wettelijke fiscale bewaarplicht).</li>
            <li>Foutmeldingen (Sentry): kortlopend, in beginsel 30 dagen.</li>
            <li>Bij accountverwijdering anonimiseren we onomkeerbaar (geen e-mail, naam, klantnummer of factuurtekst meer).</li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">5. Cookies</h2>
          <p>
            Alleen functionele/noodzakelijke cookies (sessie, voorkeuren,
            bot-bescherming via Cloudflare Turnstile). Geen tracking- of
            advertentiecookies.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">6. Jouw rechten</h2>
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

          <h2 className="text-2xl font-semibold text-slate-900">7. Beveiliging</h2>
          <p>
            HTTPS, encryptie in transit en at-rest, role-based toegang tot de
            database, rate-limiting tegen misbruik, security-headers en
            ondertekende (Svix) webhooks. Een datalek behandelen we volgens ons
            interne datalek-protocol (melding bij de AP binnen 72 uur indien
            vereist).
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">8. Wijzigingen</h2>
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
