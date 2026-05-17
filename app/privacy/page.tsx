import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacybeleid",
  description:
    "Hoe DeGeldHeld omgaat met je gegevens onder de AVG: welke data we verzamelen, hoe lang we bewaren, met wie we delen en jouw rechten.",
};

export default function PrivacyPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800">
        <h1 className="text-4xl font-bold text-slate-900">Privacybeleid</h1>
        <p className="mt-2 text-sm text-slate-500">
          Laatst bijgewerkt: {new Date().toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <section className="prose mt-10 max-w-none space-y-6">
          <p>
            DeGeldHeld respecteert je privacy en houdt zich aan de Algemene
            Verordening Gegevensbescherming (AVG/GDPR). In dit beleid leggen we
            uit welke gegevens we verwerken, waarom, met wie we ze delen en wat
            je rechten zijn.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">1. Wie we zijn</h2>
          <p>
            DeGeldHeld B.V., gevestigd in Nederland. Voor vragen of verzoeken:{" "}
            <a className="text-brand-700 underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>
            .
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">2. Welke gegevens verwerken we</h2>
          <ul className="list-disc pl-6">
            <li>
              <strong>Account</strong>: e-mailadres en — via magic-link login —
              een hash voor sessieherkenning.
            </li>
            <li>
              <strong>Rekeningen</strong>: het PDF of beeld dat je uploadt,
              plus de via AI uitgelezen velden (provider, abonnement, bedrag).
            </li>
            <li>
              <strong>Onderhandelingen</strong>: de gegenereerde e-mail, status
              (verstuurd / antwoord / uitkomst), en bespaarde bedragen.
            </li>
            <li>
              <strong>Technisch</strong>: IP-adres, browser, referrer, en
              Sentry-foutmeldingen (met cookies en authenticatie-headers
              gestript).
            </li>
            <li>
              <strong>Betaling</strong>: Stripe verwerkt je kaart; wij krijgen
              alleen status en de laatste 4 cijfers.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">3. Hoe lang bewaren we</h2>
          <ul className="list-disc pl-6">
            <li>Accountgegevens: zolang je account actief is.</li>
            <li>Uploads en analyses: <strong>90 dagen</strong> na laatste activiteit, daarna pseudonimiseren we.</li>
            <li>Betaalbewijs: 7 jaar (wettelijke fiscale plicht).</li>
            <li>Sentry foutmeldingen: 30 dagen.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">4. Met wie delen we</h2>
          <ul className="list-disc pl-6">
            <li><strong>Vercel</strong> (EU) — hosting.</li>
            <li><strong>Neon</strong> (EU) — database.</li>
            <li><strong>Resend</strong> (EU) — transactionele e-mail.</li>
            <li><strong>Groq</strong> (US) — AI-analyse van rekeningen. Beelden worden direct na verwerking gewist.</li>
            <li><strong>Stripe</strong> (EU/US) — betalingen.</li>
            <li><strong>Sentry</strong> (EU/US) — foutmeldingen.</li>
          </ul>
          <p>
            Met alle partijen hebben we een verwerkersovereenkomst. Voor
            partijen buiten de EU geldt een AVG-standaardbepaling.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">5. Cookies</h2>
          <p>
            We gebruiken alleen functionele cookies (sessie, taalvoorkeur,
            cookie-keuze). Geen tracking-cookies, geen advertentie-cookies. Bij
            je eerste bezoek vragen we toestemming.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">6. Jouw rechten</h2>
          <p>
            Je hebt onder de AVG het recht op inzage, correctie, verwijdering,
            beperking, dataportabiliteit en bezwaar. Stuur je verzoek naar{" "}
            <a className="text-brand-700 underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>{" "}
            — we reageren binnen 30 dagen. Klachten kun je ook indienen bij de
            Autoriteit Persoonsgegevens.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">7. Beveiliging</h2>
          <p>
            HTTPS, encryptie at-rest, role-based access voor onze databases,
            rate-limits tegen misbruik, en security-headers (CSP, Referrer,
            Permissions) op alle pagina's.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">8. Wijzigingen</h2>
          <p>
            Bij materiële wijzigingen mailen we je vooraf. Kleine redactionele
            updates publiceren we op deze pagina met een nieuwe datum.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
