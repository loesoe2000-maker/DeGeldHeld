import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import SavingsCard from "@/components/SavingsCard";
import NegotiationList from "@/components/NegotiationList";
import EmptyState from "@/components/EmptyState";
import CategoryUploadGrid from "@/components/CategoryUploadGrid";
import ActiveNegotiationCard from "@/components/ActiveNegotiationCard";
import { computeSavingsStats, isOpenState } from "@/lib/savings";
import { formatEurCents } from "@/lib/format";
import type { Category } from "@/lib/providers";

export const metadata = { title: "Dashboard — DeGeldHeld" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard");
  const userId = (session.user as { id: string }).id;

  const negotiations = await prisma.negotiation.findMany({
    where: { userId },
    include: { bill: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const stats = computeSavingsStats(negotiations);

  const active = negotiations
    .filter((n) => isOpenState(n.state))
    .map((n) => ({
      id: n.id,
      provider: n.bill.provider,
      category: n.bill.category,
      state: n.state as string,
      amountCents: n.bill.amountCents,
      daysSinceSent:
        n.emailSentAt != null
          ? Math.max(0, Math.floor((Date.now() - n.emailSentAt.getTime()) / (24 * 60 * 60 * 1000)))
          : null,
    }));

  const filledCategories = Array.from(
    new Set(negotiations.map((n) => n.bill.category as Category)),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{session.user.email}</p>
        </div>
        <Link
          href="/onderhandel"
          className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
        >
          + Nieuwe factuur
        </Link>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Totaal bespaard" value={formatEurCents(stats.totalSavedCents, { showDecimals: false })} tone="emerald" />
        <StatBox label="Lopend" value={`${stats.pendingCount}`} tone="amber" />
        <StatBox label="Voltooid" value={`${stats.totalSuccessful}`} tone="brand" />
        <StatBox label="Gefaald" value={`${negotiations.length - stats.totalSuccessful - stats.pendingCount}`} tone="red" />
      </div>

      <div className="mt-8">
        <SavingsCard stats={stats} />
      </div>

      {active.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Lopende onderhandelingen ({active.length})
          </h2>
          <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
            {active.map((item) => (
              <ActiveNegotiationCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-2 text-xl font-semibold text-slate-900">Voeg al je vaste lasten toe</h2>
        <p className="mb-4 text-sm text-slate-500">
          Hoe meer rekeningen je deelt, hoe meer we voor je besparen. Klik op een categorie om te uploaden.
        </p>
        <CategoryUploadGrid filledCategories={filledCategories} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Geschiedenis</h2>
        {negotiations.length === 0 ? <EmptyState /> : <NegotiationList items={negotiations} />}
      </section>
    </main>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "brand" | "red";
}) {
  const bg =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "bg-amber-50 text-amber-900"
      : tone === "brand"
      ? "bg-brand-50 text-brand-900"
      : "bg-red-50 text-red-900";
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
