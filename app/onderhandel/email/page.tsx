import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { generateEmail } from "@/lib/negotiator";
import { buildComparison } from "@/lib/comparison";
import { negotiatorCache, cacheKey } from "@/lib/llm_cache";
import EmailDisplay from "@/components/EmailDisplay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onderhandel-email — DeGeldHeld" };

export default async function EmailPage({
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

  const key = cacheKey(["negotiator", bill.id, bill.amountCents]);
  let result = negotiatorCache.get(key) as Awaited<ReturnType<typeof generateEmail>> | null;
  if (!result) {
    result = await generateEmail({
      customerName: session.user.name ?? session.user.email ?? "Klant",
      provider: bill.provider,
      category: bill.category,
      currentPlan: bill.plan,
      currentMonthlyCents: bill.amountCents,
      alternatives: comparison.topAlternatives,
    });
    negotiatorCache.set(key, result);
  }

  // Persist to negotiation
  await prisma.negotiation.upsert({
    where: { billId: bill.id },
    update: {
      state: "EMAIL_GEN",
      emailSubject: result.subject,
      emailBody: result.body,
      strategy: result.strategy,
      expectedSavingsCents: result.expectedSavingsCents,
      confidence: result.confidence,
      reasoning: result.reasoning,
    },
    create: {
      userId,
      billId: bill.id,
      state: "EMAIL_GEN",
      emailSubject: result.subject,
      emailBody: result.body,
      strategy: result.strategy,
      expectedSavingsCents: result.expectedSavingsCents,
      confidence: result.confidence,
      reasoning: result.reasoning,
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Onderhandel-email</h1>
      <p className="mt-2 text-slate-600">
        Kopieer de tekst hieronder en stuur via je eigen e-mailadres naar je provider.
      </p>
      <div className="mt-8">
        <EmailDisplay
          subject={result.subject}
          body={result.body}
          reasoning={result.reasoning}
          expectedSavingsCents={result.expectedSavingsCents}
          confidence={result.confidence}
          strategy={result.strategy}
          tonality={result.tonality}
          language={result.language}
        />
      </div>
    </main>
  );
}
