import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import RoundForm from "@/components/RoundForm";
import RoundResult from "@/components/RoundResult";
import type { RoundAnalysis } from "@/lib/rounds";
import { MAX_ROUNDS } from "@/lib/rounds";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onderhandel-ronde — DeGeldHeld" };

export default async function RoundPage({
  params,
}: {
  params: Promise<{ billId: string; n: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const { billId, n } = await params;
  const roundNumber = Number(n);
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > MAX_ROUNDS) {
    notFound();
  }

  const bill = await prisma.bill.findFirst({
    where: { id: billId, userId },
    include: {
      negotiation: {
        include: { rounds: { orderBy: { roundNumber: "asc" } } },
      },
    },
  });
  if (!bill || !bill.negotiation) notFound();

  const negotiation = bill.negotiation;
  const existingRound = negotiation.rounds.find((r) => r.roundNumber === roundNumber) ?? null;
  const priorRoundsDone = negotiation.rounds.length;

  // Hard guard: kunnen alleen ronde N starten als N-1 al bestaat (of N=1).
  if (!existingRound && roundNumber !== priorRoundsDone + 1) {
    redirect(`/onderhandel/${billId}/ronde/${priorRoundsDone + 1}`);
  }

  let parsedAnalysis: RoundAnalysis | null = null;
  if (existingRound?.analysisJson) {
    try {
      parsedAnalysis = JSON.parse(existingRound.analysisJson) as RoundAnalysis;
    } catch {
      parsedAnalysis = null;
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-600">
        Ronde {roundNumber} van {MAX_ROUNDS}
      </div>
      <h1 className="text-3xl font-bold text-slate-900">
        {bill.provider} — wat schreef de provider terug?
      </h1>
      <p className="mt-2 text-slate-600">
        Plak het antwoord of upload een screenshot. We analyseren of het aanbod
        goed genoeg is en schrijven een counter-mail als dat helpt.
      </p>

      {!existingRound ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <RoundForm negotiationId={negotiation.id} />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {existingRound.providerResponse && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-base font-semibold text-slate-900">
                Antwoord van provider
              </h2>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-700">
                {existingRound.providerResponse}
              </pre>
            </section>
          )}
          {parsedAnalysis && (
            <RoundResult
              analysis={parsedAnalysis}
              counterSubject={existingRound.counterSubject}
              counterBody={existingRound.counterBody}
              outcome={existingRound.outcome}
            />
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <form
              action={`/api/negotiations/outcome`}
              method="post"
              className="contents"
            >
              {/* Decoratief: outcome wordt momenteel als JSON gestuurd via aparte knop UI in /uitkomst. */}
            </form>
            {roundNumber < MAX_ROUNDS &&
              existingRound.outcome !== "ACCEPTED" &&
              existingRound.outcome !== "REJECTED" && (
                <a
                  href={`/onderhandel/${billId}/ronde/${roundNumber + 1}`}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Verstuur counter, ga naar ronde {roundNumber + 1}
                </a>
              )}
            <a
              href={`/onderhandel/${billId}/uitkomst`}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Akkoord — deal gesloten
            </a>
            <a
              href={`/onderhandel/${billId}/uitkomst`}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Stop hier
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
