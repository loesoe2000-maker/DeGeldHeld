"use client";
import { useState } from "react";

const items: { q: string; a: string; category?: string }[] = [
  // PRIJZEN
  {
    category: "Prijzen",
    q: "Wat kost het?",
    a: "Het gebruik van DeGeldHeld is kosteloos. Wij brengen geen fee, percentage of abonnement in rekening. De officiële procedures zelf kunnen wel kosten met zich meebrengen: de Huurcommissie hanteert bijvoorbeeld € 25 aan leges. Die betaal je aan die instantie, niet aan ons, en we vermelden ze bij de betreffende check.",
  },
  {
    category: "Prijzen",
    q: "Hoe verdienen jullie geld?",
    a: "Dat doen we niet. DeGeldHeld is een niet-commercieel project: er staat geen verdienmodel achter. Even belangrijk: we ontvangen geen commissie van providers, geen kickbacks en geen advertentievergoedingen. Er is dus geen belang dat boven het jouwe gaat.",
  },
  {
    category: "Prijzen",
    q: "Wat als de provider niet reageert?",
    a: "Dan blijft het bij de verstuurde brief; er zijn voor jou geen kosten. Na 7 dagen sturen we automatisch een herinnering.",
  },
  {
    category: "Prijzen",
    q: "Moet ik doorgeven of het gelukt is?",
    a: "Het hoeft niet, maar het helpt. Forward de bevestigingsmail van je provider naar bewijs@degeldheld.com of upload je nieuwe factuur. Dat gebruiken we alleen om ons eigen track record eerlijk bij te houden — er hangt geen rekening aan.",
  },

  // HOE HET WERKT
  {
    category: "Hoe het werkt",
    q: "Hoe lang duurt een onderhandeling?",
    a: "De mail genereren duurt ~3 minuten. De provider beantwoordt meestal binnen 5-10 werkdagen. Het hele traject loopt vaak in 2-3 weken af.",
  },
  {
    category: "Hoe het werkt",
    q: "Voor welke vaste lasten werkt het?",
    a: "Energie (stroom, gas), bankpakketten, software-saaS en overige abonnementen — daar onderhandelen we gratis namens jou. Bij telecom (mobiel, internet, tv) krijg je een vers retentie-belscript per provider en voer je het gesprek zelf — dat werkt daar aantoonbaar beter. Streaming, gym en cloud-opslag krijgen advies-tips (downgrade-tier, jaarbetaling). Hypotheek en verzekering bieden we (nog) niet aan — dat zijn financiële producten waarvoor een AFM-vergunning nodig is. Water kun je niet onderhandelen (monopolie), maar we tonen wel verbruiks-bespaartips.",
  },
  {
    category: "Hoe het werkt",
    q: "Welke landen ondersteunen jullie?",
    a: "We focussen volledig op Nederland — daar is onze geverifieerde prijsvergelijking op gebaseerd. Buitenlandse facturen herkennen we wel, maar de vergelijking is voorlopig NL-only. Andere landen volgen later.",
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
    a: "Nee. We delen geen data met providers, adverteerders of derden. Sub-processors (Vercel, Neon, Resend, Groq, Stripe, Cloudflare, Sentry) verwerken alleen wat nodig is, onder een verwerkersovereenkomst. Niet-EU-partijen (zoals Groq en Stripe) doen dat met EU-standaardclausules (SCC's).",
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
    a: "Geen probleem. We tellen een besparing pas mee als die schriftelijk is bevestigd — niet bij telefonisch contact zonder uitkomst. Als provider belt met een aanbod, kun je dat zelf aannemen of weigeren.",
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
