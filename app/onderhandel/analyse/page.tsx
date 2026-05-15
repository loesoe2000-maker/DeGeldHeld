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

  // Empty bill → OCR couldn't extract usable data. Show a graceful fallback
  // instead of letting Comparison render an empty page or silently failing.
  const ocrFailed = bill.amountCents <= 0 || bill.provider === "Onbekend" || bill.provider === "";
  if (ocrFailed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900">We konden je rekening niet automatisch uitlezen</h1>
        <p className="mt-3 text-slate-600">
          De OCR herkende geen provider of bedrag. Dit gebeurt soms bij onscherpe foto's,
          handgeschreven facturen of een onbekende leverancier.
        </p>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Wat we wel zagen:</strong>
          <ul className="mt-2 list-disc pl-5">
            <li>Provider: {bill.provider || "—"}</li>
            <li>Bedrag: {bill.amountCents > 0 ? `€${(bill.amountCents / 100).toFixed(2)}` : "—"}</li>
            <li>Plan: {bill.plan ?? "—"}</li>
          </ul>
          {bill.rawOcr && (
            <details className="mt-3 text-xs opacity-80">
              <summary className="cursor-pointer font-medium">Debug-info (technisch)</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-amber-100 p-2">
                {bill.rawOcr}
              </pre>
            </details>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/onderhandel"
            className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Probeer opnieuw met scherpere foto
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Terug naar dashboard
          </Link>
        </div>
      </main>
    );
  }

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
