import { formatEurCents } from "@/lib/format";
import type { TimelineBucket, Milestone } from "@/lib/savings-timeline";

/**
 * Server component — pure presentation of cumulative savings over time
 * (a lightweight CSS bar chart, no client JS) + a milestone nudge.
 */
export default function SavingsOverTime({
  buckets,
  milestone,
}: {
  buckets: TimelineBucket[];
  milestone: Milestone;
}) {
  const max = buckets.reduce((m, b) => Math.max(m, b.cumulativeCents), 0) || 1;

  return (
    <section data-testid="savings-over-time" className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Bespaard over tijd</h2>

      {buckets.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Zodra je eerste besparing rond is, zie je hier je opbouw over de maanden.
        </p>
      ) : (
        <div className="mt-5 flex items-end gap-3 overflow-x-auto pb-2" aria-hidden>
          {buckets.map((b) => (
            <div key={b.monthKey} className="flex min-w-[44px] flex-1 flex-col items-center">
              <div className="text-[11px] font-semibold tabular-nums text-emerald-800">
                {formatEurCents(b.cumulativeCents, { showDecimals: false })}
              </div>
              <div
                className="mt-1 w-full rounded-t bg-emerald-500"
                style={{ height: `${Math.max(6, Math.round((b.cumulativeCents / max) * 120))}px` }}
              />
              <div className="mt-1 text-[11px] text-slate-500">{b.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-lg bg-emerald-50 p-4">
        <p className="text-sm text-emerald-900">
          Je zit op <strong>{formatEurCents(milestone.savedEur * 100, { showDecimals: false })}</strong> bespaard.
          {milestone.cta ? ` ${milestone.cta}` : " Mooi werk — we blijven scannen op nieuwe kansen."}
        </p>
      </div>
    </section>
  );
}
