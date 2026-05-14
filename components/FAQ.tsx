"use client";
import { useState } from "react";

const items = [
  {
    q: "Wat kost het?",
    a: "Niks vooraf. We rekenen alleen 15% van de jaarlijkse besparing als de onderhandeling slaagt. Bespaar je niets, dan betaal je niets.",
  },
  {
    q: "Welke providers ondersteunen jullie?",
    a: "Telecom (T-Mobile, KPN, Vodafone, Tele2, Odido), internet (Ziggo, KPN, Online), energie (Eneco, Vattenfall, Essent, Greenchoice) en veel verzekeraars.",
  },
  {
    q: "Hoe wordt mijn rekening uitgelezen?",
    a: "Met Groq Vision (een snelle AI). De foto wordt eenmalig verwerkt en daarna vernietigd; alleen provider, bedrag en pakket-naam worden bewaard.",
  },
  {
    q: "Mijn provider antwoordt niet — wat dan?",
    a: "Na 7 dagen sturen we een follow-up reminder. Krijg je geen reactie of een 'nee', dan betaal je nul euro.",
  },
  {
    q: "Is dit AFM-gereguleerd?",
    a: "Nee. We zijn geen broker en geven geen financieel advies — we onderhandelen alleen op je vaste lasten. Dit valt buiten Wft-vergunningplicht.",
  },
  {
    q: "Mijn data — waar staat die?",
    a: "Vercel Postgres in EU. Je kunt op elk moment via /vergeet_mij je gegevens permanent laten verwijderen (GDPR Art. 17).",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-slate-50 px-6 py-20" id="faq">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Veelgestelde vragen
        </h2>
        <dl className="mt-10 divide-y divide-slate-200 rounded-xl bg-white">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q} className="p-6">
                <dt>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between text-left text-lg font-semibold text-slate-900"
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                  >
                    {it.q}
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
      </div>
    </section>
  );
}
