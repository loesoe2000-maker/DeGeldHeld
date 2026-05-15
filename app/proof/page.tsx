import { prisma } from "@/lib/db";
import CounterUp from "@/components/CounterUp";
import Footer from "@/components/Footer";
import Link from "next/link";
import { formatEurCents, formatPercent } from "@/lib/format";

export const metadata = { title: "Track record — DeGeldHeld" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CategoryStats = { count: number; totalCents: number };
type Period = "7d" | "30d" | "365d" | "all";

const PERIODS: Period[] = ["7d", "30d", "365d", "all"];
const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dagen",
  "30d": "30 dagen",
  "365d": "1 jaar",
  all: "Alles",
};

function cutoffFor(period: Period): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 365;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function loadStats(period: Period) {
  const cutoff = cutoffFor(period);
  const baseWhere = cutoff ? { createdAt: { gte: cutoff } } : {};

  const successful = await prisma.negotiation.findMany({
    where: { ...baseWhere, state: { in: ["SUCCESS", "BILLED"] } },
    select: { actualSavingsCents: true, bill: { select: { category: true } } },
    take: 1000,
  });
  const failed = await prisma.negotiation.count({ where: { ...baseWhere, state: "FAILED" } });

  const totalSavedCents = successful.reduce((a, n) => a + (n.actualSavingsCents ?? 0), 0);
  const totalAttempts = successful.length + failed;
  const successRate = totalAttempts > 0 ? successful.length / totalAttempts : 0;
  const avgCents = successful.length > 0 ? Math.round(totalSavedCents / successful.length) : 0;

  const byCategory: Record<string, CategoryStats> = {};
  for (const n of successful) {
    const cat = n.bill.category;
    byCategory[cat] = byCategory[cat] ?? { count: 0, totalCents: 0 };
    byCategory[cat].count += 1;
    byCategory[cat].totalCents += n.actualSavingsCents ?? 0;
  }

  return {
    totalSavedCents,
    totalSuccessful: successful.length,
    totalAttempts,
    successRate,
    avgCents,
    byCategory,
    failed,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  TELECOM: "Telecom & internet",
  ENERGIE: "Energie",
  VERZEKERING: "Verzekering",
  HYPOTHEEK: "Hypotheek",
  BANK: "Bank",
  ABONNEMENT: "Abonnementen",
  OVERIG: "Overig",
};

export default async function ProofPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: Period = (PERIODS as string[]).includes(params.period ?? "")
    ? (params.period as Period)
    : "all";
  const stats = await loadStats(period);
  return (
    <>
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">Track record</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          Anonieme statistieken van alle onderhandelingen via DeGeldHeld.
          Live data — wordt elke 5 minuten ververst.
        </p>

        <div className="mt-6 inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {PERIODS.map((p) => {
            const active = p === period;
            const href = p === "all" ? "/proof" : `/proof?period=${p}`;
            return (
              <Link
                key={p}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {PERIOD_LABELS[p]}
              </Link>
            );
          })}
        </div>

        <section className="mt-8 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-10 text-white">
          <div className="text-sm font-medium uppercase tracking-wider text-brand-100">
            Totaal bespaard ({PERIOD_LABELS[period].toLowerCase()})
          </div>
          <div className="mt-2 text-5xl font-bold tabular-nums sm:text-7xl">
            <CounterUp
              value={Math.round(stats.totalSavedCents / 100)}
              format={(n) => formatEurCents(n * 100, { showDecimals: false })}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Stat label="Onderhandelingen" value={stats.totalAttempts} />
            <Stat label="Geslaagd" value={stats.totalSuccessful} />
            <Stat
              label="Slaag-percentage"
              value={Math.round(stats.successRate * 100)}
              suffix="%"
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">Per categorie</h2>
          {Object.keys(stats.byCategory).length === 0 ? (
            <p className="mt-4 text-slate-500">Nog geen data voor deze periode — kom snel terug.</p>
          ) : (
            <ul className="mt-6 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
              {Object.entries(stats.byCategory).map(([cat, s]) => (
                <li
                  key={cat}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </div>
                    <div className="text-sm text-slate-500">
                      {s.count} geslaagde onderhandeling{s.count === 1 ? "" : "en"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-brand-700">
                      {formatEurCents(s.totalCents, { showDecimals: false })}
                    </div>
                    <div className="text-xs text-slate-500">totaal bespaard</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-lg font-semibold">Gemiddelde besparing per geslaagde onderhandeling</h2>
          <p className="mt-2 text-3xl font-bold text-brand-700">
            {formatEurCents(stats.avgCents, { showDecimals: false })}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Slaag-percentage {formatPercent(stats.successRate)} over {stats.totalAttempts} onderhandelingen.
          </p>
        </section>

        <section className="mt-12 text-center">
          <a
            href="/onderhandel"
            className="inline-block rounded-lg bg-brand-600 px-8 py-4 font-semibold text-white hover:bg-brand-700"
          >
            Start je eigen onderhandeling →
          </a>
          <p className="mt-3 text-xs text-slate-500">
            Raw JSON: <a href={`/api/proof?period=${period}`} className="text-brand-700 underline">/api/proof?period={period}</a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-brand-100">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        <CounterUp value={value} />
        {suffix}
      </div>
    </div>
  );
}
