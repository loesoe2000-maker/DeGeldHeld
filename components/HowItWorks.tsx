export default function HowItWorks() {
  const stappen = [
    {
      nr: "1",
      titel: "Upload je rekening",
      tekst: "Maak een foto van je laatste rekening. Ons systeem leest provider, bedrag en pakket automatisch in.",
    },
    {
      nr: "2",
      titel: "Wij vergelijken de markt",
      tekst: "We checken 14+ Nederlandse providers en vinden gerichte argumenten voor jouw situatie.",
    },
    {
      nr: "3",
      titel: "Wij schrijven de mail",
      tekst: "Je krijgt een persoonlijke onderhandel-email die je met één klik verstuurt naar je provider.",
    },
    {
      nr: "4",
      titel: "Je krijgt het resultaat",
      tekst: "Bespaar je? Top — je betaalt 15% van de jaarbesparing. Bespaar je niets? Geen kosten.",
    },
  ];
  return (
    <section className="bg-brand-50 px-6 py-20" id="hoe-werkt-het">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Hoe werkt het?
        </h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stappen.map((s) => (
            <li key={s.nr} className="rounded-xl bg-white p-6 shadow-sm">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-bold text-white"
                aria-hidden
              >
                {s.nr}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.titel}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.tekst}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
