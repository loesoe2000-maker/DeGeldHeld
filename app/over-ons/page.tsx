import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Over DeGeldHeld",
  description:
    "Het verhaal van DeGeldHeld: ontstaan na de Trim-sluiting, AI-gebouwd, EU-first, transparant in besparingsdata en kosten.",
};

export default function OverOnsPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800">
        <h1 className="text-4xl font-bold text-slate-900">Over DeGeldHeld</h1>

        <section className="prose mt-10 max-w-none space-y-5">
          <p className="text-lg text-slate-700">
            Nederlanders betalen jaarlijks honderden euro's te veel aan
            telecom, energie en abonnementen — niet omdat ze lui zijn, maar
            omdat onderhandelen tijd en mentale energie kost. DeGeldHeld lost
            dat op met AI: upload je rekening, wij schrijven de e-mail die
            écht werkt.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">Waarom we begonnen</h2>
          <p>
            Toen Trim — de Amerikaanse onderhandel-app — in 2023 sloot, bleef
            Europa zonder een serieuze opvolger. We dachten: dit moet kunnen
            zonder een team van 60 mensen en een sales-organisatie. Met de
            huidige generatie taalmodellen kan één goede prompt veel
            onderhandelaars vervangen.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">Hoe we het bouwen</h2>
          <ul className="list-disc pl-6">
            <li>
              <strong>Solo development</strong> met Claude — minder overhead,
              snellere iteratie, beslissingen die binnen een dag in productie staan.
            </li>
            <li>
              <strong>EU-first</strong>: hosting Vercel EU, database in Neon
              EU, e-mail via Resend EU. AI-inference bij Groq in de VS — daar
              werken we aan een EU-alternatief.
            </li>
            <li>
              <strong>Open over besparing</strong>: onze{" "}
              <Link href="/proof" className="text-brand-700 underline">
                track record
              </Link>{" "}
              toont elke maand wat we daadwerkelijk hebben weten te besparen.
              Geen marketing-cijfers — directe live data.
            </li>
            <li>
              <strong>Transparant over kosten</strong>: eerste onderhandeling
              gratis, daarna € 4,99 per dossier. Geen verborgen abonnement.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-slate-900">Wat we niet zijn</h2>
          <p>
            Geen broker, geen vergelijker, geen financieel adviseur. We geven
            geen Wft-advies. We onderhandelen niet automatisch — jij blijft
            altijd in controle van de uiteindelijke e-mail.
          </p>

          <h2 className="text-2xl font-semibold text-slate-900">Contact</h2>
          <p>
            Vragen, feedback, een rare bug?{" "}
            <a href="mailto:hallo@degeldheld.com" className="text-brand-700 underline">
              hallo@degeldheld.com
            </a>
            . Reactie binnen 24u op werkdagen.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
