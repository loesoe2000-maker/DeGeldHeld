import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Prijzen — DeGeldHeld",
  description:
    "20% no-cure-no-pay op geverifieerde besparing. Eerste 3 onderhandelingen gratis. Geen abonnement, geen verborgen kosten — je betaalt alleen als je écht hebt bespaard.",
  openGraph: {
    title: "DeGeldHeld — eerlijk geprijsd, geen besparing geen rekening",
    description: "20% van geverifieerde besparing, gecapped op €50. Eerste 3 gratis.",
  },
};

export default function PrijsPage() {
  return (
    <>
      <main className="mx-auto max-w-4xl px-6 py-16">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Prijzen</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-900 sm:text-5xl">
            Geen besparing, geen rekening.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Je betaalt alleen als de provider écht akkoord gaat met een lager bedrag.
            We sturen niets in rekening voordat je het op papier hebt staan.
          </p>
        </header>

        {/* Hoofd-tier */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-10 text-white shadow-xl">
          <div className="text-sm font-medium uppercase tracking-wider text-brand-100">
            Standaard
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-6xl font-bold">20%</div>
            <div className="text-lg text-brand-100">van je geverifieerde jaarbesparing</div>
          </div>
          <ul className="mt-6 space-y-2 text-brand-50">
            <li>✓ Eerste 3 onderhandelingen helemaal gratis</li>
            <li>✓ Alleen factuur bij bewezen besparing &gt; €25/jaar</li>
            <li>✓ Maximale fee €50 per onderhandeling — bij grote besparing zit jij in de winst</li>
            <li>✓ Geen abonnement, niets om op te zeggen</li>
            <li>✓ Bewijs via forwarded provider-mail of nieuwe factuur — wij verifiëren automatisch</li>
          </ul>
        </section>

        {/* Voorbeelden */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">Wat betaal je in de praktijk?</h2>
          <p className="mt-2 text-slate-600">
            Drie echte scenario's met DeGeldHeld-fee t.o.v. wat je bespaart.
          </p>
          <ul className="mt-6 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
            <Example
              category="Telecom"
              before="€42/mnd"
              after="€32/mnd"
              yearlySavings={120}
              fee={24}
            />
            <Example
              category="Energie"
              before="€180/mnd"
              after="€140/mnd"
              yearlySavings={480}
              fee={50}
              feeNote="(cap)"
            />
            <Example
              category="Verzekering"
              before="€60/mnd"
              after="€48/mnd"
              yearlySavings={144}
              fee={28.8}
            />
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Onder €25/jaar besparing rekenen we geen fee — niet de moeite waard
            voor jou en niet voor ons.
          </p>
        </section>

        {/* Vergelijking */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-slate-900">DeGeldHeld vs Trim (US)</h2>
          <p className="mt-2 text-slate-600">
            Trim was de Amerikaanse marktleider die in 2024 sloot. Wij zijn de EU-versie —
            maar fundamenteel anders.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="p-4 font-semibold text-slate-700"></th>
                  <th className="p-4 font-semibold text-slate-700">Trim (US)</th>
                  <th className="p-4 font-semibold text-brand-700">DeGeldHeld</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <Row label="Fee" trim="33% recurring elk jaar" us="20% éénmalig" />
                <Row label="Cap op fee" trim="Geen" us="€50 per onderhandeling" />
                <Row label="Bank-login verplicht" trim="Ja" us="Nee — geen bank-koppeling" />
                <Row label="EU/AVG-compliant" trim="Nee" us="Ja, EU-eerste" />
                <Row label="Multi-round counter" trim="1 ronde" us="Tot 3 rondes met AI-counter" />
                <Row label="Categorieën" trim="Vooral abonnementen" us="Telecom, energie, verzekering, etc." />
                <Row label="Transparant /proof" trim="Nee" us="Live cijfers per categorie" />
                <Row label="Status" trim="Dood (Q1 2024)" us="Live in NL/BE" />
              </tbody>
            </table>
          </div>
        </section>

        {/* Alternatief */}
        <section className="mt-16 rounded-xl border border-slate-200 bg-slate-50 p-8">
          <h3 className="text-lg font-semibold text-slate-900">
            Liever geen variabele fee? €4,99/maand abonnement.
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Voor wie veel onderhandelt of het simpeler wil houden: vast bedrag,
            onbeperkte onderhandelingen, opzegbaar elk moment. Geen fee per onderhandeling.
          </p>
          <Link
            href="/account"
            className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Activeer abonnement →
          </Link>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Eerste onderhandeling is gratis.</h2>
          <p className="mt-2 text-slate-600">
            Probeer het — als je niet bespaart hoef je nooit te betalen.
          </p>
          <Link
            href="/onderhandel"
            className="mt-6 inline-block rounded-lg bg-brand-600 px-8 py-4 font-semibold text-white hover:bg-brand-700"
          >
            Start gratis onderhandeling →
          </Link>
          <p className="mt-3 text-xs text-slate-500">
            Meer vragen? Bekijk de <Link href="/faq" className="text-brand-700 underline">FAQ</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Example({
  category,
  before,
  after,
  yearlySavings,
  fee,
  feeNote,
}: {
  category: string;
  before: string;
  after: string;
  yearlySavings: number;
  fee: number;
  feeNote?: string;
}) {
  const netto = yearlySavings - fee;
  return (
    <li className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-5 sm:items-center">
      <div className="font-semibold text-slate-900">{category}</div>
      <div className="text-sm text-slate-500">
        <span className="line-through">{before}</span>{" "}
        <span className="text-slate-700">→ {after}</span>
      </div>
      <div className="text-sm">
        <span className="text-slate-500">Bespaart:</span>{" "}
        <span className="font-medium text-emerald-700">€{yearlySavings}/jr</span>
      </div>
      <div className="text-sm">
        <span className="text-slate-500">Onze fee:</span>{" "}
        <span className="font-medium text-slate-700">
          €{fee.toFixed(2)} {feeNote}
        </span>
      </div>
      <div className="text-sm sm:text-right">
        <span className="text-slate-500">Jij houdt over:</span>{" "}
        <span className="font-bold text-brand-700">€{netto.toFixed(2)}</span>
      </div>
    </li>
  );
}

function Row({ label, trim, us }: { label: string; trim: string; us: string }) {
  return (
    <tr>
      <td className="p-4 font-medium text-slate-700">{label}</td>
      <td className="p-4 text-slate-500">{trim}</td>
      <td className="p-4 font-medium text-slate-900">{us}</td>
    </tr>
  );
}
