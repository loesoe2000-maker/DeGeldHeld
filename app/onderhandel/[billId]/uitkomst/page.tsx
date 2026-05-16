import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyOutcomeToken } from "@/lib/outcome_token";
import OutcomeForm from "@/components/OutcomeForm";

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
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900">Uitkomst is al vastgelegd</h1>
        <p className="mt-3 text-slate-600">
          Status: <strong>{bill.negotiation.state}</strong>
          {bill.negotiation.actualSavingsCents != null && (
            <> — €{(bill.negotiation.actualSavingsCents / 100).toFixed(0)}/jaar bespaard.</>
          )}
        </p>
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
