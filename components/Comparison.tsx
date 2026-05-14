import { formatEurCents, formatPercent } from "@/lib/format";
import type { ComparisonResult } from "@/lib/comparison";

export default function Comparison({ result }: { result: ComparisonResult }) {
  const { current, topAlternatives, bestSavingsCents, bestSavingsPct } = result;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-medium text-slate-500">Jouw huidige situatie</h3>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-2xl font-bold text-slate-900">{current.provider}</span>
          <span className="text-lg text-slate-700">{formatEurCents(current.amountCents)}/mnd</span>
        </div>
      </div>

      {topAlternatives.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          Geen goedkoper alternatief gevonden — je zit al goed.
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-brand-600 p-6 text-white">
            <div className="text-sm uppercase tracking-wide text-brand-100">Mogelijke besparing</div>
            <div className="mt-1 text-4xl font-bold">
              {formatEurCents(bestSavingsCents, { showDecimals: false })}/jaar
            </div>
            <div className="mt-1 text-brand-100">
              ({formatPercent(bestSavingsPct)} korting t.o.v. huidig)
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-500">Top alternatieven</h3>
            <ul className="space-y-3">
              {topAlternatives.map((alt, i) => (
                <li
                  key={`${alt.plan.provider}-${alt.plan.name}`}
                  className={`rounded-xl border p-4 ${
                    i === 0 ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{alt.plan.provider}</div>
                      <div className="text-sm text-slate-600">{alt.plan.name}</div>
                      <div className="text-xs text-slate-500">{alt.plan.features}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-brand-700">
                        {formatEurCents(alt.plan.priceCents)}/mnd
                      </div>
                      <div className="text-xs text-slate-500">
                        −{formatEurCents(alt.yearlySavingsCents, { showDecimals: false })}/jr
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
