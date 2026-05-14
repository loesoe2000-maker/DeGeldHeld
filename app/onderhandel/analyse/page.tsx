import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Comparison from "@/components/Comparison";
import { buildComparison } from "@/lib/comparison";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analyse — DeGeldHeld" };

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const params = await searchParams;
  const billId = params.bill;
  if (!billId) redirect("/onderhandel");

  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) redirect("/onderhandel");

  const comparison = buildComparison({
    provider: bill.provider,
    category: bill.category,
    amountCents: bill.amountCents,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Analyse</h1>
      <p className="mt-2 text-slate-600">
        Op basis van je {bill.provider}-rekening hebben we de markt gecheckt.
      </p>
      <div className="mt-8">
        <Comparison result={comparison} />
      </div>
      <div className="mt-10 flex gap-3">
        <Link
          href={`/onderhandel/email?bill=${bill.id}`}
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Genereer onderhandel-email
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          Annuleren
        </Link>
      </div>
    </main>
  );
}
