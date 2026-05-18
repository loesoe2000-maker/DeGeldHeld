"use client";
import { useState } from "react";

const items: { q: string; a: string; category?: string }[] = [
  // PRIJZEN
  {
    category: "Prijzen",
    q: "Wat kost het?",
    a: "Niks vooraf. De eerste 3 onderhandelingen zijn 100% gratis. Daarna rekenen we 20% van de geverifieerde jaarbesparing — alleen als de provider écht akkoord ging. Geen besparing = geen rekening.",
  },
  {
    category: "Prijzen",
    q: "Hoe verdienen jullie geld?",
    a: "Alleen via die 20% fee op geverifieerde besparing. We krijgen géén commissie van providers, kickbacks of verborgen advertentie-deals. Onze prikkel is jouw besparing, niet ergens anders.",
  },
  {
    category: "Prijzen",
    q: "Wat als de provider niet reageert?",
    a: "Geen reactie binnen 14 werkdagen = geen besparing = geen rekening. We sturen wel automatisch een reminder na 7 dagen.",
  },
  {
    category: "Prijzen",
    q: "Moet ik bewijzen dat ik écht heb bespaard?",
    a: "Ja, één keer per onderhandeling. Forward de bevestigingsmail van je provider naar bewijs@degeldheld.com, of upload je nieuwe factuur na 1 maand. Geen bewijs = succes telt niet mee en geen fee.",
  },
  {
    category: "Prijzen",
    q: "Is er een maximum aan de fee?",
    a: "Ja. De fee is gecapped op €50 per onderhandeling, ongeacht hoeveel je bespaart. Minimaal €5 boven €25/jaar besparing.",
  },

  // HOE HET WERKT
  {
    category: "Hoe het werkt",
    q: "Hoe werkt het concreet?",
    a: "1) Upload een foto of PDF van je factuur. 2) Onze AI leest provider, bedrag en pakket. 3) We vergelijken met de markt. 4) Je krijgt een onderhandel-mail die je zelf verstuurt. 5) Provider antwoordt → wij analyseren → counter-mail tot deal of breekpunt.",
  },
  {
    category: "Hoe het werkt",
    q: "Hoe lang duurt een onderhandeling?",
    a: "De mail genereren duurt ~3 minuten. De provider beantwoordt meestal binnen 5-10 werkdagen. Het hele traject loopt vaak in 2-3 weken af.",
  },
  {
    category: "Hoe het werkt",
    q: "Voor welke vaste lasten werkt het?",
    a: "Telecom (mobiel, internet, tv), energie (stroom, gas, warmte), verzekeringen (zorg, auto, woon), bankpakketten, streaming, gym, software-abonnementen. Hypotheken via een aparte flow. Water en gemeente-belasting kunnen we niet onderhandelen — die zijn monopolie.",
  },
  {
    category: "Hoe het werkt",
    q: "Welke landen ondersteunen jullie?",
    a: "Volledig: Nederland en België. Beta: Duitsland, Frankrijk, UK. Andere landen werken vaak ook maar zonder geverifieerde provider-database.",
  },
  {
    category: "Hoe het werkt",
    q: "Werkt het ook voor PDF-facturen?",
    a: "Ja. We renderen pagina 1 van je PDF tot een afbeelding en lezen die uit met dezelfde Vision AI. Werkt voor zowel direct gemaakte PDFs als gescande facturen.",
  },

  // PRIVACY
  {
    category: "Privacy & data",
    q: "Wat doen jullie met mijn factuur?",
    a: "We lezen 'm één keer uit met Groq Vision en slaan provider, bedrag en pakket op. De originele factuur-foto bewaren we niet. Je klantnummer wordt gebruikt om de retentie-mail effectief te maken. Geen IBAN of adres in onze database.",
  },
  {
    category: "Privacy & data",
    q: "Wordt mijn data gedeeld?",
    a: "Nee. We delen geen data met providers, adverteerders of derden. Sub-processors (Vercel hosting, Neon database, Resend mail, Groq AI) verwerken alleen wat nodig is en zitten allemaal in EU.",
  },
  {
    category: "Privacy & data",
    q: "Kan ik mijn account verwijderen?",
    a: "Ja, AVG-recht. Via /account klik je 'Verwijder mijn account' en alles wordt binnen 30 dagen gewist. Je kunt ook eerst je data downloaden als JSON.",
  },
  {
    category: "Privacy & data",
    q: "Bewaren jullie bank-gegevens?",
    a: "Nee. We hebben geen bank-login nodig, in tegenstelling tot Amerikaanse tools zoals Trim. Je betaalt eventuele fee via Stripe; wij zien alleen je email-adres en de transactie-status, niet je rekening.",
  },

  // TWIJFELS
  {
    category: "Twijfels",
    q: "Wat als ik niet bespaar maar de provider belt me terug?",
    a: "Geen probleem. Onze fee triggert pas bij bevestigde besparing op papier — niet bij telefonisch contact zonder uitkomst. Als provider belt met een aanbod, kun je dat zelf aannemen of weigeren.",
  },
  {
    category: "Twijfels",
    q: "Wat als de provider mij weigert?",
    a: "Dan eindigt de onderhandeling. Geen fee. We sturen je wel een korte uitleg waarom het waarschijnlijk niet werkte (te kort klant, recent contract, etc.) en wanneer je het opnieuw kan proberen.",
  },
  {
    category: "Twijfels",
    q: "Is dit financieel advies?",
    a: "Nee. We zijn geen broker, AFM-gereguleerde adviseur of intermediair. We onderhandelen alleen op je bestaande contract — geen advies over wat je moet kiezen.",
  },
  {
    category: "Twijfels",
    q: "Wat als jullie morgen failliet zijn?",
    a: "Je data wordt vernietigd, je kunt 'm vooraf downloaden via /account. Geen lopende onderhandelingen breken — die mails staan al bij je provider. Stripe handelt eventuele open fees zelf af.",
  },
];

const categories = Array.from(new Set(items.map((i) => i.category ?? "Algemeen")));

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const [filter, setFilter] = useState<string>("Alle");

  const filtered = filter === "Alle" ? items : items.filter((i) => i.category === filter);

  return (
    <section className="bg-slate-50 px-6 py-20" id="faq">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Veelgestelde vragen</h2>
        <p className="mt-2 text-slate-600">{items.length} antwoorden, onderverdeeld in categorieën.</p>

        <div className="mt-6 flex flex-wrap gap-2" role="tablist">
          {(["Alle", ...categories] as string[]).map((c) => {
            const active = c === filter;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setFilter(c);
                  setOpen(null);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                aria-pressed={active}
              >
                {c}
              </button>
            );
          })}
        </div>

        <dl className="mt-8 divide-y divide-slate-200 rounded-xl bg-white">
          {filtered.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q} className="p-6">
                <dt>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-[44px] w-full items-center justify-between text-left text-lg font-semibold text-slate-900"
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                  >
                    <span>
                      {it.q}
                      {it.category && (
                        <span className="ml-2 align-middle text-xs font-medium uppercase tracking-wide text-brand-700">
                          {it.category}
                        </span>
                      )}
                    </span>
                    <span className="ml-4 text-brand-600" aria-hidden>
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </dt>
                {isOpen && (
                  <dd id={`faq-${i}`} className="mt-3 text-slate-600">
                    {it.a}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            Antwoord niet gevonden? Mail{" "}
            <a className="text-brand-700 underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
