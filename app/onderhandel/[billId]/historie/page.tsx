import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tijdlijn — DeGeldHeld" };

function fmt(dt: Date | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
}

export default async function HistoriePage({ params }: { params: Promise<{ billId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const { billId } = await params;

  const bill = await prisma.bill.findFirst({
    where: { id: billId, userId },
    include: {
      negotiation: { include: { rounds: { orderBy: { roundNumber: "asc" } } } },
    },
  });
  if (!bill) notFound();

  type Step = { at: Date | null; label: string; detail: string };
  const steps: Step[] = [];
  steps.push({ at: bill.createdAt, label: "Factuur geüpload", detail: `${bill.provider} — €${(bill.amountCents / 100).toFixed(2).replace(".", ",")}` });
  if (bill.invoiceDate) {
    steps.push({ at: bill.invoiceDate, label: "Factuur-periode", detail: bill.period ?? "" });
  }
  const neg = bill.negotiation;
  if (neg) {
    steps.push({ at: neg.createdAt, label: "Onderhandel-mail gegenereerd", detail: neg.strategy ?? "" });
    if (neg.emailSentAt) steps.push({ at: neg.emailSentAt, label: "Mail verstuurd", detail: neg.emailSubject ?? "" });
    for (const r of neg.rounds) {
      steps.push({ at: r.createdAt, label: `Ronde ${r.roundNumber}`, detail: r.providerResponse?.slice(0, 120) ?? r.outcome });
    }
    if (neg.outcomeAskedAt) steps.push({ at: neg.outcomeAskedAt, label: "Uitkomst opgevraagd", detail: "" });
    if (neg.closedAt) steps.push({ at: neg.closedAt, label: "Afgesloten", detail: neg.state });
  }
  if (bill.lastRecheckAt) {
    steps.push({ at: bill.lastRecheckAt, label: "Laatste markt-recheck", detail: "" });
  }
  if (bill.deletedAt) {
    steps.push({ at: bill.deletedAt, label: "Verwijderd", detail: "" });
  }

  steps.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-slate-500">DeGeldHeld → {bill.provider} → Tijdlijn</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Tijdlijn — {bill.provider}</h1>
      <p className="mt-1 text-sm text-slate-500">€{(bill.amountCents / 100).toFixed(2).replace(".", ",")}/maand · {bill.category}</p>

      <ol data-testid="history-timeline" className="mt-8 space-y-4 border-l border-slate-200 pl-6">
        {steps.map((s, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
            <div className="text-sm text-slate-500">{fmt(s.at)}</div>
            <div className="text-base font-semibold text-slate-900">{s.label}</div>
            {s.detail && <div className="text-sm text-slate-600">{s.detail}</div>}
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={`/onderhandel/analyse?bill=${billId}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Terug naar analyse
        </Link>
        <Link href="/dashboard" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
