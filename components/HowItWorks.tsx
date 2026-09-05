export default function HowItWorks() {
  const stappen = [
    {
      nr: "1",
      titel: "Kies een route",
      tekst:
        "Upload je rekening óf doe een gratis check: toeslagen, Box 3-rechtsherstel, NS-vertraging, zorgkosten, huurcommissie, energie-eindafrekening of vlucht.",
    },
    {
      nr: "2",
      titel: "Wij analyseren",
      tekst:
        "Onze sourced engines rekenen op de officiële 2026-regels (Belastingdienst / NS / Huurcommissie / EU-261). Geen DigiD — je gegevens blijven in je browser.",
    },
    {
      nr: "3",
      titel: "Wij leveren de brief",
      tekst:
        "Pre-gefilde brief of mail, klaar om in te dienen bij de Belastingdienst, Huurcommissie, Geschillencommissie of je provider. Jij blijft de regie houden.",
    },
    {
      nr: "4",
      titel: "Jij houdt alles",
      tekst:
        "Het geld dat je terugkrijgt gaat rechtstreeks naar jou. Wij rekenen geen percentage en geen abonnement — DeGeldHeld is gratis.",
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
