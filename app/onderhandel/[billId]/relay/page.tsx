import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import RelayControls from "@/components/RelayControls";
import { relayStatusLabel } from "@/lib/relay";
import { isEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automatisch onderhandelen — DeGeldHeld" };

/**
 * v23 DEEL 5 — full transparency: every mail sent on the customer's behalf +
 * every provider reply, the live status badge, and the pause/stop (and, when
 * a deal is on the table, accept/continue/stop) controls. Nothing is hidden.
 */
export default async function RelayPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  // GUARDRAIL 7 — relay gated behind the flag. Off → the page doesn't exist
  // (the manual copy-to-send flow stays; no relay UI is reachable).
  if (!isEnabled("RELAY_ENABLED")) notFound();

  const session = await auth();
  if (!session?.user) redirect(`/login?from=/onderhandel/${billId}/relay`);
  const userId = (session.user as { id: string }).id;

  const negotiation = await prisma.negotiation.findFirst({
    where: { billId, userId },
    include: { bill: true, rounds: { orderBy: { roundNumber: "asc" } } },
  });
  if (!negotiation) notFound();

  const authorized = !!negotiation.relayAuthorizedAt;
  const badge = relayStatusLabel(negotiation.relayState);

  const fmtTs = (d: Date | null | undefined): string =>
    d
      ? new Intl.DateTimeFormat("nl-NL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(d))
      : "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">
        Onderhandeling met {negotiation.bill.provider}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{session.user.email}</p>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
        <span
          data-testid="relay-status-badge"
          className={
            negotiation.relayState === "AWAITING_APPROVAL"
              ? "font-semibold text-amber-700"
              : negotiation.relayState === "RELAY_ACTIVE"
                ? "font-semibold text-emerald-700"
                : "font-semibold text-slate-700"
          }
        >
          {badge}
        </span>
      </div>

      {!authorized ? (
        <p className="mt-6 text-slate-600">
          Voor deze onderhandeling is geen automatische relay gemachtigd. Ga
          terug naar de{" "}
          <Link href={`/onderhandel/email?bill=${billId}`} className="underline">
            onderhandel-mail
          </Link>{" "}
          om DeGeldHeld te machtigen, of mail zelf.
        </p>
      ) : (
        <>
          {negotiation.relayState === "AWAITING_APPROVAL" && (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              <strong>Er ligt een voorstel dat jouw beslissing nodig heeft.</strong>{" "}
              We accepteren nooit automatisch — kies hieronder.
            </div>
          )}

          <RelayControls negotiationId={negotiation.id} relayState={negotiation.relayState} />

          <h2 className="mt-10 text-xl font-semibold text-slate-900">Gesprek</h2>
          <p className="mt-1 text-sm text-slate-500">
            Alles wat namens jou is verstuurd en elk antwoord van {negotiation.bill.provider}.
          </p>

          <ol className="mt-4 space-y-4">
            {negotiation.emailBody && (
              <li className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Namens jou verstuurd — eerste onderhandel-mail
                </div>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-800">
                  {negotiation.emailBody}
                </pre>
              </li>
            )}
            {negotiation.rounds.map((r) => (
              <li key={r.id} className="space-y-3">
                {r.providerResponse && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {negotiation.bill.provider} antwoordde · ronde {r.roundNumber}
                      {fmtTs(r.createdAt) && (
                        <span className="ml-2 font-normal normal-case text-slate-400">
                          {fmtTs(r.createdAt)}
                        </span>
                      )}
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-800">
                      {r.providerResponse}
                    </pre>
                  </div>
                )}
                {r.counterBody && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                      {r.confirmedSentAt ? "Namens jou verstuurd" : "Klaargezet"} · counter ronde {r.roundNumber}
                      {fmtTs(r.confirmedSentAt ?? r.createdAt) && (
                        <span className="ml-2 font-normal normal-case text-brand-400">
                          {fmtTs(r.confirmedSentAt ?? r.createdAt)}
                        </span>
                      )}
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-800">
                      {r.counterBody}
                    </pre>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/dashboard" className="underline">← Terug naar dashboard</Link>
      </div>
    </main>
  );
}
