import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatEurCents, formatPercent } from "@/lib/format";
import { PAYWALL_FEE_CENTS } from "@/lib/payments";
import PayButton from "@/components/PayButton";
import PaywallButton from "@/components/PaywallButton";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voltooien — DeGeldHeld" };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const { id } = await params;
  const { status, type } = await searchParams;

  // DEEL 10 paywall flow — id is a billId, not a negotiationId.
  if (type === "paywall") {
    const bill = await prisma.bill.findFirst({ where: { id, userId } });
    if (!bill) redirect("/dashboard");
    if (bill.paidAt) redirect(`/onderhandel/analyse?bill=${bill.id}&paid=1`);
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900">
          Nog één stap — €{(PAYWALL_FEE_CENTS / 100).toFixed(2)}
        </h1>
        <p className="mt-2 text-slate-600">
          Je eerste onderhandeling was gratis. Voor elke volgende rekening
          rekenen we een vast bedrag van{" "}
          <strong>€{(PAYWALL_FEE_CENTS / 100).toFixed(2)}</strong> per dossier —
          dat dekt de AI-analyse en de gegenereerde onderhandelings-mail.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="text-sm text-slate-500">Rekening</div>
          <div className="text-lg font-semibold">{bill.provider}</div>
          <div className="text-sm text-slate-500">
            {bill.plan ?? bill.category} ·{" "}
            {formatEurCents(bill.monthlyCents ?? bill.amountCents)}/maand
          </div>
        </div>

        {status === "cancelled" && (
          <p className="mt-4 text-sm text-amber-700">
            Betaling geannuleerd — je kunt het opnieuw proberen.
          </p>
        )}

        <div className="mt-6">
          <PaywallButton billId={bill.id} amountCents={PAYWALL_FEE_CENTS} />
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Betaling via Stripe · iDEAL en credit card. Na betaling word je
          direct teruggestuurd naar de analyse van deze rekening.
        </p>
      </main>
    );
  }

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, userId },
    include: { bill: true, payment: true },
  });
  if (!negotiation) redirect("/dashboard");

  const isPaid = negotiation.payment?.status === "PAID" || status === "success";
  const isCancelled = status === "cancelled";
  const fee = negotiation.payment?.amountCents ?? 0;
  const savings = negotiation.actualSavingsCents ?? 0;
  const netUser = Math.max(savings - fee, 0);
  const feePct = savings > 0 ? fee / savings : 0;

  if (isPaid) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          ✓
        </div>
        <h1 className="mt-6 text-3xl font-bold text-brand-700">Bedankt!</h1>
        <p className="mt-3 text-slate-600">
          Je betaling van {formatEurCents(fee)} is verwerkt. Je hebt
          {" "}
          <strong>{formatEurCents(savings)}</strong> bespaard op {negotiation.bill.provider}.
        </p>
        <div className="mt-8 rounded-xl bg-brand-50 p-6 text-left">
          <div className="flex items-center justify-between border-b border-brand-200 pb-2">
            <span className="text-sm text-slate-600">Jouw bruto besparing</span>
            <span className="font-medium">{formatEurCents(savings)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-brand-200 py-2">
            <span className="text-sm text-slate-600">DeGeldHeld fee (15%)</span>
            <span className="font-medium">−{formatEurCents(fee)}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold">Netto in jouw zak</span>
            <span className="text-xl font-bold text-brand-700">{formatEurCents(netUser)}</span>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Naar dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Voltooi je betaling</h1>
      <p className="mt-2 text-slate-600">
        Een transparante breakdown — je betaalt alleen wanneer er bespaard is.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-sm text-slate-500">Provider</div>
        <div className="text-lg font-semibold">{negotiation.bill.provider}</div>

        <hr className="my-4" />

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Jaarlijkse besparing</dt>
            <dd className="font-bold text-brand-700">{formatEurCents(savings)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">DeGeldHeld success-fee (15%)</dt>
            <dd className="font-medium">−{formatEurCents(fee)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
            <dt className="font-semibold">Netto in jouw zak</dt>
            <dd className="text-xl font-bold text-brand-700">{formatEurCents(netUser)}</dd>
          </div>
        </dl>
      </div>

      {isCancelled && (
        <p className="mt-4 text-sm text-amber-700">
          Je betaling is geannuleerd — je kunt het opnieuw proberen.
        </p>
      )}

      <div className="mt-6">
        <PayButton negotiationId={negotiation.id} amountCents={fee} />
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">
        Betaling via Stripe · iDEAL en credit card · Niet tevreden? Vraag refund binnen 30 dagen ({formatPercent(feePct)} fee).
      </p>
    </main>
  );
}
