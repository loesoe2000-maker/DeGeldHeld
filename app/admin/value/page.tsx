import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin_auth";
import { gatherTraction, computeValue, formatEur } from "@/lib/value-tracker";
import { formatEurCents } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Waarde-tracker — Admin" };

export default async function ValuePage() {
  if (!(await isAdmin())) redirect("/dashboard");

  const t = await gatherTraction();
  const v = computeValue(t);

  // North-Star: doelen per bracket
  const nextMilestone = t.totalUsers < 50
    ? { users: 50, label: "Validated MVP (€10k+)" }
    : t.totalUsers < 500
    ? { users: 500, label: "Proven traction (€80k+)" }
    : t.totalUsers < 5_000
    ? { users: 5_000, label: "Acquisition target (€500k+)" }
    : { users: 50_000, label: "Series A territory (€5M+)" };
  const usersToGo = Math.max(0, nextMilestone.users - t.totalUsers);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Waarde-tracker</h1>
          <p className="mt-1 text-sm text-slate-500">
            Geschatte bedrijfswaarde DeGeldHeld op basis van traction-metrics.
            Geen formele waardering — een North-Star getal om naar te werken.
          </p>
        </div>
      </header>

      <section className="mt-8 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-10 text-white">
        <div className="text-sm font-medium uppercase tracking-wider text-brand-100">
          Geschatte waarde nu
        </div>
        <div className="mt-2 text-5xl font-bold tabular-nums sm:text-7xl">
          {formatEur(v.total)}
        </div>
        <div className="mt-3 text-sm text-brand-100">{v.bracketLabel}</div>
        {usersToGo > 0 && (
          <div className="mt-6 rounded-lg bg-white/10 p-3 text-sm">
            Volgende mijlpaal: <strong>{nextMilestone.label}</strong> bij{" "}
            <strong>{nextMilestone.users.toLocaleString("nl-NL")}</strong> users
            ({usersToGo.toLocaleString("nl-NL")} te gaan)
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Waarde-opbouw</h2>
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
          <Row label="Base — werkende MVP + brand + domain" amount={v.baseValue} />
          <Row label={`Actieve users (30d) — ${t.activeUsersLast30d} × €120`} amount={v.fromActiveUsers} />
          <Row label={`Betalende users — ${t.payingUsers} × €600`} amount={v.fromPayingUsers} />
          <Row
            label={`ARR ${formatEurCents(t.arrCents, { showDecimals: false })} × 8`}
            amount={v.fromArr}
          />
          <Row
            label={`Geslaagde onderhandelingen — ${t.successfulNegotiations} × €40`}
            amount={v.fromSuccesses}
          />
          <Row
            label={`Pers-mentions — ${t.pressMentions} × €5.000`}
            amount={v.fromPress}
            hint="Bij te houden via env-var TRACTION_PRESS_COUNT"
          />
          <Row
            label={`Partnerships — ${t.partnerships} × €5.000`}
            amount={v.fromPartnerships}
            hint="Bij te houden via env-var TRACTION_PARTNERSHIPS"
          />
          <li className="flex items-center justify-between bg-slate-50 p-4">
            <div className="font-bold text-slate-900">Totaal</div>
            <div className="text-2xl font-bold text-brand-700">{formatEur(v.total)}</div>
          </li>
        </ul>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Totaal users" value={t.totalUsers.toLocaleString("nl-NL")} />
        <StatBox label="Actief (30d)" value={t.activeUsersLast30d.toLocaleString("nl-NL")} />
        <StatBox label="Betalend" value={t.payingUsers.toLocaleString("nl-NL")} />
        <StatBox
          label="Totaal bespaard"
          value={formatEurCents(t.totalSavedCents, { showDecimals: false })}
        />
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        <h3 className="text-base font-semibold text-slate-900">Methodologie</h3>
        <p className="mt-2">
          Berekening is een pragmatische benadering van indie-acquisition-prijzen
          (Flippa/MicroAcquire/AcquireFire benchmarks) plus SaaS-multiple op ARR
          voor pre-PMF deals. Geen DCF, geen formele waardering — louter een
          richting-getal.
        </p>
        <p className="mt-2">
          Wat <em>niet</em> in dit getal zit: jouw tijd-investering, juridische
          status (BV/KvK), brand-waarde buiten domein, technische schuld,
          jurisdictie-arbitrage, of een acqui-hire-premium.
        </p>
        <p className="mt-2">
          Bij funding-gesprekken gebruik je dit als <strong>onderkant</strong> van
          de valuation-range. Investors waarderen <em>vooruit</em>, niet op
          huidige metrics.
        </p>
      </section>
    </main>
  );
}

function Row({
  label,
  amount,
  hint,
}: {
  label: string;
  amount: number;
  hint?: string;
}) {
  return (
    <li className="flex items-center justify-between p-4">
      <div>
        <div className="text-sm text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
      <div className="text-lg font-semibold text-slate-900 tabular-nums">
        {formatEur(amount)}
      </div>
    </li>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}
