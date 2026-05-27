import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  getUserClaims,
  computeStats,
  type DashboardClaim,
} from "@/lib/claim-dashboard";
import { formatEurCents } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mijn claims — DeGeldHeld",
  description:
    "Status-overzicht van al je Box 3-, Huurcommissie- en Energie-claims " +
    "op één plek.",
};

/**
 * v36 idee 1 — claim-dashboard. Auth-gated server page die alle drie
 * claim-types aggregeert in één overzicht. Géén verzonnen deadlines —
 * waar we geen anchor-timestamp hebben tonen we tekstuele verwachtingen
 * uit de pure mapper in lib/claim-dashboard.
 */
export default async function ClaimDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/account/claims");
  const userId = (session.user as { id: string }).id;

  const claims = await getUserClaims(userId, prisma);
  const stats = computeStats(claims);
  const open = claims.filter((c) => !c.closed);
  const closed = claims.filter((c) => c.closed);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Mijn claims
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Status van je claims
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Alles wat we voor je in behandeling hebben (Box 3-rechtsherstel,
          Huurcommissie-servicekosten en Energie-eindafrekening) op één plek
          — met de volgende stap per claim.
        </p>
      </header>

      {/* Stats-strip */}
      <section
        data-testid="claim-stats"
        className="mt-8 grid gap-3 sm:grid-cols-3"
      >
        <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
            Open claims
          </p>
          <p
            data-testid="stat-open"
            className="mt-1 text-2xl font-bold text-slate-900"
          >
            {stats.openCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-600">
            Verwacht openstaand
          </p>
          <p
            data-testid="stat-expected"
            className="mt-1 text-2xl font-bold text-slate-900"
          >
            {formatEurCents(stats.totalExpectedCents)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">
            Werkelijk terug
          </p>
          <p
            data-testid="stat-recovered"
            className="mt-1 text-2xl font-bold text-slate-900"
          >
            {formatEurCents(stats.totalRecoveredCents)}
          </p>
        </div>
      </section>

      {claims.length === 0 ? (
        <section
          data-testid="claims-empty"
          className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            Nog geen claims
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Zodra je een Box 3-, Huurcommissie- of Energie-claim indient,
            verschijnt hij hier met status + volgende stap.
          </p>
          <Link
            href="/vind-al-je-geld"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Start een check →
          </Link>
        </section>
      ) : (
        <>
          {open.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900">
                Lopende claims ({open.length})
              </h2>
              <ul
                data-testid="claims-open"
                className="mt-4 grid gap-4"
              >
                {open.map((c) => (
                  <ClaimCard key={`${c.type}:${c.id}`} claim={c} />
                ))}
              </ul>
            </section>
          ) : null}

          {closed.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900">
                Afgeronde claims ({closed.length})
              </h2>
              <ul
                data-testid="claims-closed"
                className="mt-4 grid gap-4"
              >
                {closed.map((c) => (
                  <ClaimCard key={`${c.type}:${c.id}`} claim={c} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/account" className="underline">
          ← Terug naar account
        </Link>
      </div>
    </main>
  );
}

function ClaimCard({ claim }: { claim: DashboardClaim }) {
  const isClosed = claim.closed;
  const isFailed = claim.statusCode === "FAILED";
  return (
    <li
      data-testid={`claim-${claim.type}-${claim.id}`}
      data-status={claim.statusCode}
      className={
        "rounded-2xl border p-5 shadow-sm " +
        (isFailed
          ? "border-rose-200 bg-rose-50/50"
          : isClosed
            ? "border-slate-200 bg-white"
            : "border-brand-200 bg-white")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{claim.titel}</h3>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {claim.statusLabel}
          </p>
        </div>
        <span
          className={
            "shrink-0 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide " +
            (isFailed
              ? "bg-rose-100 text-rose-800"
              : isClosed
                ? "bg-slate-100 text-slate-700"
                : "bg-brand-100 text-brand-800")
          }
        >
          {isFailed ? "Mislukt" : isClosed ? "Afgerond" : "Lopend"}
        </span>
      </div>

      <p
        data-testid={`claim-next-step-${claim.id}`}
        className="mt-3 text-sm text-slate-700"
      >
        <span className="font-semibold">Volgende stap:</span> {claim.nextStep}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wider text-slate-500">
            Verwacht
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {formatEurCents(claim.verwachteRestitutieCents)}
          </dd>
        </div>
        {claim.werkelijkeRestitutieCents != null ? (
          <div>
            <dt className="text-xs uppercase tracking-wider text-emerald-700">
              Werkelijk
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatEurCents(claim.werkelijkeRestitutieCents)}
            </dd>
          </div>
        ) : null}
        {claim.feeCents != null && claim.feeCents > 0 ? (
          <div>
            <dt className="text-xs uppercase tracking-wider text-slate-500">
              Fee betaald
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatEurCents(claim.feeCents)}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-4 text-xs text-slate-500">
        Aangemaakt op{" "}
        {claim.createdAt.toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {claim.hasUploadedDoc ? " — bewijsdocument geüpload" : ""}
        {claim.chargedAt
          ? ` — verrekend op ${claim.chargedAt.toLocaleDateString("nl-NL")}`
          : ""}
      </p>
    </li>
  );
}
