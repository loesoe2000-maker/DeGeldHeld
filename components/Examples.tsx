export default function Examples() {
  const cases = [
    {
      provider: "T-Mobile (mobiel)",
      voor: "€42,50/mnd",
      na: "€27,00/mnd",
      besparing: "€186/jaar",
    },
    {
      provider: "Ziggo (internet+TV)",
      voor: "€67,95/mnd",
      na: "€49,95/mnd",
      besparing: "€216/jaar",
    },
    {
      provider: "Eneco (energie)",
      voor: "€186/mnd",
      na: "€158/mnd",
      besparing: "€336/jaar",
    },
  ];
  return (
    <section className="bg-white px-6 py-20" id="voorbeelden">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Echte besparingen
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Anonieme voorbeelden van resultaten van DeGeldHeld-leden
          (zie <a href="/api/proof" className="text-brand-700 underline">/api/proof</a> voor live cijfers).
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {cases.map((c) => (
            <div key={c.provider} className="rounded-xl border-2 border-brand-200 bg-brand-50 p-6">
              <div className="text-sm font-medium text-slate-600">{c.provider}</div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-slate-400 line-through">{c.voor}</span>
                <span className="text-xl font-bold text-brand-700">{c.na}</span>
              </div>
              <div className="mt-4 text-2xl font-bold text-brand-700">{c.besparing}</div>
              <div className="text-xs text-slate-500">jaarlijkse besparing</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
