import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import ProviderCandidateRow from "@/components/ProviderCandidateRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Provider Candidates" };

export default async function AdminProvidersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isAdmin())) redirect("/dashboard");

  const candidates = await prisma.providerCandidate.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const grouped = {
    pending: candidates.filter((c) => c.status === "PENDING"),
    approved: candidates.filter((c) => c.status === "APPROVED"),
    rejected: candidates.filter((c) => c.status === "REJECTED"),
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Provider candidates</h1>
      <p className="mt-2 text-slate-600">
        Onbekende providers die via OCR zijn ontdekt. Approve → vervolgens
        handmatig in <code>lib/providers.ts</code> plakken via{" "}
        <code>scripts/sync-approved-providers.ts</code>.
      </p>

      <Section title={`Pending (${grouped.pending.length})`} candidates={grouped.pending} />
      <Section title={`Approved (${grouped.approved.length})`} candidates={grouped.approved} />
      <Section title={`Rejected (${grouped.rejected.length})`} candidates={grouped.rejected} />
    </main>
  );
}

function Section({
  title,
  candidates,
}: {
  title: string;
  candidates: Array<{
    id: string;
    name: string;
    country: string;
    retentionJson: string;
    status: string;
    createdAt: Date;
  }>;
}) {
  if (candidates.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <ul className="mt-4 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
        {candidates.map((c) => (
          <ProviderCandidateRow key={c.id} candidate={c} />
        ))}
      </ul>
    </section>
  );
}
