import { formatEurCents, formatPercent } from "@/lib/format";
import type { ComparisonResult } from "@/lib/comparison";

function ConfidenceBadge({ pct }: { pct: number }) {
  const label = pct >= 75 ? "Hoog" : pct >= 50 ? "Gemiddeld" : "Laag";
  const colorClass =
    pct >= 75
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : pct >= 50
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-rose-100 text-rose-700 border-rose-200";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      title={`Confidence ${pct}/100`}
    >
      <span aria-hidden>●</span>
      Zekerheid: {label} ({pct}%)
    </span>
  );
}

function MarketRangeBar({
  range,
  userAmountCents,
}: {
  range: ComparisonResult["marketRange"];
  userAmountCents: number;
}) {
  if (range.sampleSize === 0) return null;
  const span = Math.max(1, range.maxCents - range.minCents);
  const userPos = Math.max(
    0,
    Math.min(100, ((userAmountCents - range.minCents) / span) * 100),
  );
  const medianPos = ((range.medianCents - range.minCents) / span) * 100;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Markt-range deze categorie</h3>
        <span className="text-xs text-slate-500">{range.sampleSize} pakketten vergeleken</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-rose-300">
        <div
          className="absolute -top-1 h-5 w-1 rounded bg-slate-900"
          style={{ left: `calc(${userPos}% - 2px)` }}
          title={`Jouw bedrag: ${formatEurCents(userAmountCents)}`}
        />
        <div
          className="absolute -top-0.5 h-4 w-0.5 rounded bg-slate-500"
          style={{ left: `calc(${medianPos}% - 1px)` }}
          title={`Markt-mediaan: ${formatEurCents(range.medianCents)}`}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{formatEurCents(range.minCents)}/mnd</span>
        <span>mediaan {formatEurCents(range.medianCents)}/mnd</span>
        <span>{formatEurCents(range.maxCents)}/mnd</span>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Jouw bedrag valt in het{" "}
        <strong>{range.userPercentile}e percentiel</strong>{" "}
        ({range.userPercentile >= 75 ? "duurste kwart van de markt" : range.userPercentile >= 50 ? "duurder dan helft" : range.userPercentile >= 25 ? "goedkoper dan helft" : "goedkoopste kwart"}).
      </p>
    </div>
  );
}

export default function Comparison({ result }: { result: ComparisonResult }) {
  const {
    current,
    topAlternatives,
    bestSavingsCents,
    bestSavingsPct,
    marketRange,
    confidencePct,
  } = result;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-500">Jouw huidige situatie</h3>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-slate-900">{current.provider}</span>
              <span className="text-lg text-slate-700">{formatEurCents(current.amountCents)}/mnd</span>
            </div>
          </div>
          <ConfidenceBadge pct={confidencePct} />
        </div>
      </div>

      <MarketRangeBar range={marketRange} userAmountCents={current.amountCents} />

      {topAlternatives.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          Geen goedkoper alternatief gevonden — je zit al goed.
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-brand-600 p-6 text-white shadow-lg">
            <div className="text-sm uppercase tracking-wide text-brand-100">Jaarlijkse besparing</div>
            <div className="mt-1 text-5xl font-bold">
              {formatEurCents(bestSavingsCents, { showDecimals: false })}
            </div>
            <div className="mt-2 text-brand-100">
              {formatPercent(bestSavingsPct)} korting t.o.v. huidig — gemiddeld{" "}
              {formatEurCents(Math.round(bestSavingsCents / 12), { showDecimals: false })}/maand
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-500">3 beste alternatieven</h3>
            <ul className="space-y-3">
              {topAlternatives.slice(0, 3).map((alt, i) => (
                <li
                  key={`${alt.plan.provider}-${alt.plan.name}`}
                  className={`rounded-xl border p-4 ${
                    i === 0 ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{alt.plan.provider}</span>
                        {i === 0 && (
                          <span className="rounded bg-brand-600 px-1.5 py-0.5 text-xs font-medium text-white">
                            Beste deal
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">{alt.plan.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{alt.plan.features}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-brand-700">
                        {formatEurCents(alt.plan.priceCents)}/mnd
                      </div>
                      <div className="text-xs text-slate-500">
                        −{formatEurCents(alt.yearlySavingsCents, { showDecimals: false })}/jaar
                      </div>
                    </div>
                  </div>
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                      Waarom dit advies?
                    </summary>
                    <p className="mt-2 text-slate-600">{alt.rationale}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
