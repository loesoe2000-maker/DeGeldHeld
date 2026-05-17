import Link from "next/link";
import { DEMO_FIXTURES, getDemoFixture, type DemoFixture } from "@/lib/demo-fixtures";

export const dynamic = "force-static";
export const metadata = {
  title: "Demo — DeGeldHeld in 30 seconden",
  description: "Bekijk hoe DeGeldHeld werkt met een voorbeeld-factuur. Geen upload, geen account.",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string }>;
}) {
  const { bill } = await searchParams;
  const selected = bill ? getDemoFixture(bill) : undefined;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div data-testid="demo-banner" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Demo-modus.</strong> Dit is een voorbeeld-factuur — er wordt niets opgeslagen.
        Wil je je eigen factuur testen? <Link href="/login" className="underline">Maak een gratis account</Link>.
      </div>

      <h1 className="text-3xl font-bold text-slate-900">DeGeldHeld in 30 seconden</h1>
      <p className="mt-2 text-slate-600">
        Kies een voorbeeld-factuur en zie de hele flow: analyse, alternatieven, gegenereerde mail.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DEMO_FIXTURES.map((f) => (
          <Link
            key={f.id}
            href={`/demo?bill=${f.id}`}
            data-testid={`demo-tab-${f.id}`}
            className={`rounded-xl border p-4 text-left transition ${
              selected?.id === f.id
                ? "border-brand-600 bg-brand-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="text-2xl">{f.emoji}</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{f.label}</div>
            <div className="mt-1 text-xs text-slate-500">€{(f.bill.monthlyCents / 100).toFixed(2).replace(".", ",")}/mnd</div>
          </Link>
        ))}
      </div>

      {selected && <DemoView fixture={selected} />}
      {!selected && (
        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Klik op een voorbeeld-factuur hierboven om de demo te starten.
        </div>
      )}

      <div className="mt-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
        <h2 className="text-xl font-bold">Probeer 't met je eigen factuur</h2>
        <p className="mt-1 text-sm text-brand-50">Eerste onderhandeling gratis. Geen creditcard nodig.</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-slate-100">
          Begin gratis →
        </Link>
      </div>
    </main>
  );
}

function DemoView({ fixture }: { fixture: DemoFixture }) {
  const { bill, analysis, mail } = fixture;
  return (
    <>
      <section data-testid="demo-bill" className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Je voorbeeld-factuur</div>
        <div className="mt-2 text-xl font-semibold text-slate-900">{bill.provider} — {bill.plan}</div>
        <div className="mt-1 text-sm text-slate-600">Periode {bill.period} • €{(bill.monthlyCents / 100).toFixed(2).replace(".", ",")}/maand</div>
      </section>

      <section data-testid="demo-analysis" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">Markt-analyse</div>
        <div className="mt-1 text-3xl font-bold text-emerald-700">
          €{(analysis.yearlySavingsCents / 100).toFixed(0)} potentiële jaarbesparing
        </div>
        <p className="mt-2 text-sm text-emerald-900">{analysis.note}</p>
        <ul className="mt-4 space-y-2 text-sm text-emerald-900">
          {analysis.alternatives.map((a) => (
            <li key={a.name} className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2">
              <span><strong>{a.name}</strong> · {a.notes}</span>
              <span className="font-semibold tabular-nums">€{(a.monthlyCents / 100).toFixed(2).replace(".", ",")}/mnd</span>
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="demo-mail" className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Voorbeeld-onderhandelmail</div>
        <div className="mt-2 text-lg font-semibold text-slate-900">{mail.subject}</div>
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-sans text-sm text-slate-800">{mail.body}</pre>
        <div className="mt-3 text-xs text-slate-500">
          Strategie: <strong>{mail.strategy.replace(/_/g, " ")}</strong> · vertrouwen {Math.round(mail.confidence * 100)}%
        </div>
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">Waarom deze hoek?</summary>
          <p className="mt-2">{mail.reasoning}</p>
        </details>
      </section>
    </>
  );
}
