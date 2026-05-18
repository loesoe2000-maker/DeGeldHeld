import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/fraud-detection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fraud review — DeGeldHeld admin" };

export default async function FraudPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isAdmin())) notFound();

  const flags = await prisma.fraudFlag.findMany({
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { user: { select: { id: true, email: true, suspendedAt: true } } },
  });

  const open = flags.filter((f) => !f.resolved);
  const resolved = flags.filter((f) => f.resolved);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Fraud review</h1>
      <p className="mt-2 text-sm text-slate-600">
        Score &ge; {FRAUD_FLAG_THRESHOLD} = automatisch geflagd. Klik op een
        rij om unflag of suspend te bevestigen.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Geen openstaande flags.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
            {open.map((f) => (
              <li key={f.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-slate-900">
                      {f.user.email}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      score <strong>{f.score}</strong> ·{" "}
                      {new Date(f.createdAt).toLocaleString("nl-NL")}
                      {f.user.suspendedAt && (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-900">
                          suspended
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={`/api/admin/fraud/${f.id}/unflag`} method="post">
                      <button
                        type="submit"
                        data-testid="unflag-btn"
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Unflag
                      </button>
                    </form>
                    <form action={`/api/admin/fraud/${f.id}/suspend`} method="post">
                      <button
                        type="submit"
                        data-testid="suspend-btn"
                        className="rounded-md bg-rose-600 px-3 py-1 text-sm font-medium text-white hover:bg-rose-700"
                      >
                        Suspend
                      </button>
                    </form>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">
                  {f.reasons}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">
          Recent resolved ({resolved.length})
        </h2>
        {resolved.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Geen recente resolved flags.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl bg-white text-sm shadow-sm">
            {resolved.slice(0, 20).map((f) => (
              <li key={f.id} className="flex justify-between p-3">
                <span className="font-mono text-slate-700">{f.user.email}</span>
                <span className="text-xs text-slate-500">
                  score {f.score} · resolved{" "}
                  {f.resolvedAt
                    ? new Date(f.resolvedAt).toLocaleDateString("nl-NL")
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
