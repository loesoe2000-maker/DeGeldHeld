import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatEurCents } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voltooien — DeGeldHeld" };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const { id } = await params;
  const { status } = await searchParams;

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, userId },
    include: { bill: true, payment: true },
  });
  if (!negotiation) redirect("/dashboard");

  const isPaid = negotiation.payment?.status === "PAID" || status === "success";
  const isCancelled = status === "cancelled";
  const fee = negotiation.payment?.amountCents ?? 0;
  const savings = negotiation.actualSavingsCents ?? 0;

  if (isPaid) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          ✓
        </div>
        <h1 className="mt-6 text-3xl font-bold text-brand-700">Bedankt!</h1>
        <p className="mt-3 text-slate-600">
          Je betaling van {formatEurCents(fee)} is verwerkt. Je hebt {formatEurCents(savings)} bespaard
          op {negotiation.bill.provider}.
        </p>
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
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-sm text-slate-500">Provider</div>
        <div className="text-lg font-semibold">{negotiation.bill.provider}</div>
        <hr className="my-4" />
        <div className="text-sm text-slate-500">Jouw besparing dit jaar</div>
        <div className="text-2xl font-bold text-brand-700">{formatEurCents(savings)}</div>
        <div className="mt-4 text-sm text-slate-500">Onze success-fee (15%)</div>
        <div className="text-xl font-bold">{formatEurCents(fee)}</div>
      </div>

      {isCancelled && (
        <p className="mt-4 text-sm text-amber-700">
          Je betaling is geannuleerd — je kunt het opnieuw proberen.
        </p>
      )}

      <form action="/api/checkout" method="POST" className="mt-6">
        <input type="hidden" name="negotiationId" value={negotiation.id} />
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Betaal {formatEurCents(fee)} via iDEAL of card
        </button>
      </form>
    </main>
  );
}
