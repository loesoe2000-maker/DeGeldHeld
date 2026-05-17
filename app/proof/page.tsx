import { prisma } from "@/lib/db";
import CounterUp from "@/components/CounterUp";
import Footer from "@/components/Footer";
import Link from "next/link";
import { formatEurCents, formatPercent } from "@/lib/format";

export const metadata = {
  title: "Track record",
  description:
    "Bekijk hoeveel DeGeldHeld voor klanten heeft bespaard — totale besparing, slaagkans en gemiddelde besparing per onderhandeling, transparant per periode.",
  openGraph: {
    title: "DeGeldHeld track record — transparante besparing per maand",
    description:
      "Live cijfers: totale besparing, slaagpercentage en gemiddelde besparing per onderhandeling.",
  },
};

const datasetLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "DeGeldHeld track record",
  description:
    "Geanonimiseerde besparingsdata van DeGeldHeld onderhandelingen, vernieuwd per minuut.",
  url: "https://degeldheld.com/proof",
  creator: { "@type": "Organization", name: "DeGeldHeld" },
  distribution: [
    {
      "@type": "DataDownload",
      contentUrl: "https://degeldheld.com/api/proof",
      encodingFormat: "application/json",
    },
  ],
};
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

type Basis = "actual" | "expected";

async function loadStats(period: Period, basis: Basis, country: string | null, category: string | null) {
  const cutoff = cutoffFor(period);
  const billWhere: Record<string, unknown> = {};
  if (country) billWhere.country = country;
  if (category) billWhere.category = category;

  const successWhere: Record<string, unknown> = {
    state: { in: ["SUCCESS", "BILLED", "ACCEPTED"] },
  };
  if (cutoff) successWhere.createdAt = { gte: cutoff };
  if (Object.keys(billWhere).length > 0) successWhere.bill = billWhere;

  const failedWhere: Record<string, unknown> = {
    state: { in: ["FAILED", "REJECTED"] },
  };
  if (cutoff) failedWhere.createdAt = { gte: cutoff };
  if (Object.keys(billWhere).length > 0) failedWhere.bill = billWhere;

  const successful = await prisma.negotiation.findMany({
    where: successWhere,
    select: {
      actualSavingsCents: true,
      expectedSavingsCents: true,
      bill: { select: { category: true } },
    },
    take: 1000,
  });
  const failed = await prisma.negotiation.count({ where: failedWhere });

  function val(n: { actualSavingsCents: number | null; expectedSavingsCents: number | null }): number {
    if (basis === "actual") return n.actualSavingsCents ?? 0;
    return n.expectedSavingsCents ?? 0;
  }

  const totalSavedCents = successful.reduce((a, n) => a + val(n), 0);
  const totalAttempts = successful.length + failed;
  const successRate = totalAttempts > 0 ? successful.length / totalAttempts : 0;
  const avgCents = successful.length > 0 ? Math.round(totalSavedCents / successful.length) : 0;

  const byCategory: Record<string, CategoryStats> = {};
  for (const n of successful) {
    const cat = n.bill.category;
    byCategory[cat] = byCategory[cat] ?? { count: 0, totalCents: 0 };
    byCategory[cat].count += 1;
    byCategory[cat].totalCents += val(n);
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

const COUNTRY_OPTIONS = ["NL", "BE", "DE", "FR", "UK", "US", "ES", "IT"];
const CATEGORY_OPTIONS = [
  "TELECOM", "ENERGIE", "VERZEKERING", "HYPOTHEEK", "BANK",
  "STREAMING", "GYM", "SOFTWARE", "OPSLAG", "OV", "ABONNEMENT", "OVERIG",
];

function buildHref(p: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `/proof?${s}` : "/proof";
}

export default async function ProofPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; basis?: string; country?: string; category?: string }>;
}) {
  const params = await searchParams;
  const period: Period = (PERIODS as string[]).includes(params.period ?? "")
    ? (params.period as Period)
    : "all";
  const basis: Basis = params.basis === "expected" ? "expected" : "actual";
  const country = COUNTRY_OPTIONS.includes(params.country ?? "") ? params.country! : null;
  const category = CATEGORY_OPTIONS.includes(params.category ?? "") ? params.category! : null;
  const stats = await loadStats(period, basis, country, category);
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }}
      />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">Track record</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          Anonieme statistieken van alle onderhandelingen via DeGeldHeld.
          Live data — wordt elke 5 minuten ververst.
        </p>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterGroup label="Periode">
              {PERIODS.map((p) => (
                <FilterPill
                  key={p}
                  href={buildHref({ period: p === "all" ? null : p, basis: basis === "actual" ? null : basis, country, category })}
                  active={p === period}
                  variant="brand"
                >
                  {PERIOD_LABELS[p]}
                </FilterPill>
              ))}
            </FilterGroup>
            <FilterGroup label="Basis">
              {(["actual", "expected"] as Basis[]).map((b) => (
                <FilterPill
                  key={b}
                  href={buildHref({ period: period === "all" ? null : period, basis: b === "actual" ? null : b, country, category })}
                  active={b === basis}
                  variant="emerald"
                >
                  {b === "actual" ? "Behaald" : "Verwacht"}
                </FilterPill>
              ))}
            </FilterGroup>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FilterGroup label="Land">
              <FilterPill href={buildHref({ period: period === "all" ? null : period, basis: basis === "actual" ? null : basis, country: null, category })} active={country === null} variant="slate">Alle</FilterPill>
              {COUNTRY_OPTIONS.map((c) => (
                <FilterPill
                  key={c}
                  href={buildHref({ period: period === "all" ? null : period, basis: basis === "actual" ? null : basis, country: c, category })}
                  active={c === country}
                  variant="slate"
                >
                  {c}
                </FilterPill>
              ))}
            </FilterGroup>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FilterGroup label="Categorie">
              <FilterPill href={buildHref({ period: period === "all" ? null : period, basis: basis === "actual" ? null : basis, country, category: null })} active={category === null} variant="slate">Alle</FilterPill>
              {CATEGORY_OPTIONS.map((c) => (
                <FilterPill
                  key={c}
                  href={buildHref({ period: period === "all" ? null : period, basis: basis === "actual" ? null : basis, country, category: c })}
                  active={c === category}
                  variant="slate"
                >
                  {CATEGORY_LABELS[c] ?? c}
                </FilterPill>
              ))}
            </FilterGroup>
          </div>
        </div>

        <section className="mt-8 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-10 text-white">
          <div className="text-sm font-medium uppercase tracking-wider text-brand-100">
            Totaal bespaard ({PERIOD_LABELS[period].toLowerCase()})
          </div>
          <div className="mt-2 text-5xl font-bold tabular-nums sm:text-7xl">
            <CounterUp
              value={Math.round(stats.totalSavedCents / 100)}
              formatType="eur"
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">{children}</div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  variant,
  children,
}: {
  href: string;
  active: boolean;
  variant: "brand" | "emerald" | "slate";
  children: React.ReactNode;
}) {
  const activeCls =
    variant === "brand"
      ? "bg-brand-600 text-white shadow-sm"
      : variant === "emerald"
      ? "bg-emerald-600 text-white shadow-sm"
      : "bg-slate-700 text-white shadow-sm";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? activeCls : "text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
