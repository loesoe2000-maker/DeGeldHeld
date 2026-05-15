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

  // v3.1: compare op het maand-abonnement (niet het totaal incl. eenmalige
  // posten). bill.amountCents is al door upload-route op monthly gezet als die
  // beschikbaar is, maar oude records kunnen alleen totalCents/amountCents hebben.
  const comparisonAmount = bill.monthlyCents ?? bill.amountCents;
  const comparison = buildComparison({
    provider: bill.provider,
    category: bill.category,
    amountCents: comparisonAmount,
  });

  // Toon blauwe info-balk als factuur eenmalige posten bevat (>5% verschil
  // tussen total en monthly).
  const showOneTimeBanner =
    bill.monthlyCents != null &&
    bill.totalCents != null &&
    bill.totalCents > 0 &&
    Math.abs(bill.totalCents - bill.monthlyCents) / bill.totalCents > 0.05;
  const oneTimeDeltaCents = showOneTimeBanner
    ? (bill.totalCents ?? 0) - (bill.monthlyCents ?? 0)
    : 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Analyse</h1>
      <p className="mt-2 text-slate-600">
        Op basis van je {bill.provider}-rekening hebben we de markt gecheckt.
      </p>
      {showOneTimeBanner && (
        <div
          role="status"
          data-testid="onetime-banner"
          className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
        >
          <strong>Eenmalige posten op deze factuur.</strong> Je factuur bevat{" "}
          €{(oneTimeDeltaCents / 100).toFixed(2).replace(".", ",")} aan eenmalige
          posten. We vergelijken op je vaste maand-abonnement van{" "}
          €{((bill.monthlyCents ?? 0) / 100).toFixed(2).replace(".", ",")}.
        </div>
      )}
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
