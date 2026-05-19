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
import { ensureReferralCode, buildShareUrl } from "@/lib/referral";
import ReferralBlock from "@/components/ReferralBlock";

export const metadata = { title: "Dashboard — DeGeldHeld" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard");
  const userId = (session.user as { id: string }).id;

  // v15 page-level claim: catch anonymous bills via cookie OR via
  // the email stamped during the email-prompt. Email-branch handles
  // the cross-browser case (magic-link opens in default browser
  // outside the incognito session that did the upload).
  const userEmail = session.user.email ?? null;
  const { ensureBillsClaimed } = await import("@/lib/ensure-claim");
  const claim = await ensureBillsClaimed(userId, userEmail);
  if (claim.firstBillId) {
    redirect(`/onderhandel/email?bill=${claim.firstBillId}`);
  }

  const negotiations = await prisma.negotiation.findMany({
    where: { userId, bill: { deletedAt: null } },
    include: { bill: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const stats = computeSavingsStats(negotiations);

  const active = negotiations
    .filter((n) => isOpenState(n.state))
    .map((n) => ({
      // The round route is /onderhandel/[billId]/ronde/[n], so we link via
      // billId. Negotiation.id was a leftover from before the rounds feature
      // existed and produced a 404 on the "Ik kreeg antwoord" button.
      id: n.billId,
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
        <div className="flex items-center gap-3">
          <Link
            href="/account"
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            Account
          </Link>
          <Link
            href="/onderhandel"
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            + Nieuwe factuur
          </Link>
        </div>
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

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Snelle upload via email</h2>
        <p className="mt-1 text-sm text-slate-600">
          Forward je factuur naar <a href="mailto:inbox@degeldheld.com?subject=Mijn%20factuur" className="font-mono text-brand-700 underline">inbox@degeldheld.com</a>.
          We analyseren 'm en sturen je een link terug.
        </p>
      </section>

      {await renderReferralSection(userId)}

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

async function renderReferralSection(userId: string) {
  let code = "";
  let used = 0;
  try {
    code = await ensureReferralCode(userId);
    used = await prisma.referral.count({ where: { ownerId: userId, usedAt: { not: null } } });
  } catch {
    return null;
  }
  const url = buildShareUrl(code, process.env.APP_URL ?? "https://degeldheld.com");
  return (
    <section data-testid="referral-block" className="mt-10 rounded-xl border border-brand-200 bg-brand-50 p-6">
      <h2 className="text-xl font-semibold text-brand-900">Verdien gratis onderhandelingen</h2>
      <p className="mt-1 text-sm text-brand-800">
        Voor élke vriend die aansluit via jouw link krijg je 1 gratis onderhandeling (paywall wordt overgeslagen).
      </p>
      <ReferralBlock url={url} count={used} />
    </section>
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
