import { formatEurCents, formatPercent } from "@/lib/format";
import type { SavingsStats } from "@/lib/savings";

export default function SavingsCard({ stats }: { stats: SavingsStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat
        label="Totaal bespaard"
        value={formatEurCents(stats.totalSavedCents, { showDecimals: false })}
        accent
      />
      <Stat
        label="Geslaagde onderhandelingen"
        value={`${stats.totalSuccessful} / ${stats.totalAttempts}`}
        sub={stats.totalAttempts > 0 ? formatPercent(stats.successRate) : "—"}
      />
      <Stat
        label="In behandeling"
        value={String(stats.pendingCount)}
        sub={stats.averageSavingsCents > 0 ? `gem. ${formatEurCents(stats.averageSavingsCents)}` : ""}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        accent ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accent ? "text-brand-700" : "text-slate-900"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
