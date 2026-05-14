export default function Problem() {
  const items = [
    {
      titel: "Loyale klanten betalen het meest",
      tekst:
        "Providers geven nieuwe klanten de scherpste deals. Wie blijft, betaalt soms 30-40% meer voor exact dezelfde dienst.",
    },
    {
      titel: "Onderhandelen kost tijd én moed",
      tekst:
        "Bellen met retentie-afdelingen, dreigen met overstappen, drie keer doorverbonden worden. De meeste mensen geven het op.",
    },
    {
      titel: "Markt verandert sneller dan jij kunt bijhouden",
      tekst:
        "Tarieven, kortingen en aanbiedingen verschuiven elke maand. Wij houden de markt in de gaten — jij niet.",
    },
  ];
  return (
    <section className="bg-white px-6 py-20" id="probleem">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Waarom betaal jij eigenlijk te veel?
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Drie redenen waarom Nederlandse huishoudens jaarlijks honderden euro's
          laten liggen op vaste maandlasten.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {items.map((it) => (
            <div key={it.titel} className="rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-brand-700">{it.titel}</h3>
              <p className="mt-2 text-slate-600">{it.tekst}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
