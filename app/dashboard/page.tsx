import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import SavingsCard from "@/components/SavingsCard";
import NegotiationList from "@/components/NegotiationList";
import EmptyState from "@/components/EmptyState";
import { computeSavingsStats } from "@/lib/savings";
import Link from "next/link";

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
    take: 50,
  });

  const stats = computeSavingsStats(negotiations);

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
          + Nieuwe onderhandeling
        </Link>
      </header>

      <div className="mt-8">
        <SavingsCard stats={stats} />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Geschiedenis</h2>
        {negotiations.length === 0 ? <EmptyState /> : <NegotiationList items={negotiations} />}
      </section>
    </main>
  );
}
