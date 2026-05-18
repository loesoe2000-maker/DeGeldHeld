import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyOutcomeToken } from "@/lib/outcome_token";
import OutcomeForm from "@/components/OutcomeForm";
import ShareKit from "@/components/ShareKit";
import { ensureReferralCode } from "@/lib/referral";

export const dynamic = "force-dynamic";
export const metadata = { title: "Uitkomst onderhandeling — DeGeldHeld" };

export default async function UitkomstPage({
  params,
  searchParams,
}: {
  params: Promise<{ billId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { billId } = await params;
  const { token } = await searchParams;

  // Two auth paths: signed-in user OR valid token from follow-up email.
  let authorized = false;
  const session = await auth();
  if (session?.user) {
    const userId = (session.user as { id: string }).id;
    const owned = await prisma.bill.findFirst({
      where: { id: billId, userId },
      select: { id: true },
    });
    if (owned) authorized = true;
  }
  if (!authorized && token) {
    const v = verifyOutcomeToken(token);
    if (v.ok && v.billId === billId) authorized = true;
  }
  if (!authorized) {
    if (!session?.user) redirect("/login");
    notFound();
  }

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { negotiation: true },
  });
  if (!bill || !bill.negotiation) notFound();

  const monthlyCents = bill.monthlyCents ?? bill.amountCents;

  if (bill.negotiation.closedAt) {
    const yearly = bill.negotiation.actualSavingsCents ?? 0;
    const isSuccess = yearly > 0;
    const feeCents = bill.negotiation.feeAmountCents ?? 0;
    const pendingFee =
      bill.negotiation.state === "BILLED_PENDING_PAYMENT" && feeCents > 0;
    let referralCode: string | undefined;
    if (isSuccess && session?.user) {
      try {
        referralCode = await ensureReferralCode((session.user as { id: string }).id);
      } catch {
        // no-op
      }
    }
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900">Uitkomst is al vastgelegd</h1>
        <p className="mt-3 text-slate-600">
          Status: <strong>{bill.negotiation.state}</strong>
          {bill.negotiation.actualSavingsCents != null && (
            <> — €{(bill.negotiation.actualSavingsCents / 100).toFixed(0)}/jaar bespaard.</>
          )}
        </p>
        {pendingFee && (
          <section
            data-testid="fee-cta"
            className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5"
          >
            <h2 className="text-lg font-semibold text-brand-900">
              Je bespaarde €{(yearly / 100).toFixed(0)} — onze bijdrage is €
              {(feeCents / 100).toFixed(2).replace(".", ",")}
            </h2>
            <p className="mt-1 text-sm text-brand-900">
              No-cure-no-pay: 20% van de geverifieerde besparing, met een
              maximum van €25,00. Betaal binnen 14 dagen om je onderhandeling
              officieel af te ronden.
            </p>
            <form action={`/api/checkout/${bill.negotiation.id}`} method="post" className="mt-4">
              <button
                type="submit"
                data-testid="pay-fee-btn"
                className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
              >
                Betaal €{(feeCents / 100).toFixed(2).replace(".", ",")} via Stripe
              </button>
            </form>
          </section>
        )}
        {isSuccess && (
          <div className="mt-10">
            <ShareKit
              savedYearlyEur={Math.round(yearly / 100)}
              provider={bill.provider}
              referralCode={referralCode}
            />
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900">
        Hoe ging het met {bill.provider}?
      </h1>
      <p className="mt-3 text-slate-600">
        Vertel ons de uitkomst zodat we onze Track Record actueel kunnen houden.
        Het kost je maar één klik.
      </p>
      <div className="mt-8">
        <OutcomeForm
          negotiationId={bill.negotiation.id}
          currentMonthlyCents={monthlyCents}
        />
      </div>
    </main>
  );
}
