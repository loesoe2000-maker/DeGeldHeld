import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import AccountControls from "@/components/AccountControls";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mijn account — DeGeldHeld" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/account");
  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      notificationsEnabled: true,
      ocrTrainingOptIn: true,
      createdAt: true,
    },
  });
  if (!user) redirect("/login");

  const sessions = await prisma.session.findMany({
    where: { userId, expires: { gte: new Date() } },
    select: { id: true, expires: true },
    orderBy: { expires: "desc" },
    take: 10,
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Mijn account</h1>
      <p className="mt-1 text-sm text-slate-500">{user.email}</p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Data downloaden (AVG art. 20)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Krijg een JSON-bestand met alles wat we over jou bewaren — bills,
          onderhandelingen, payments, sessies.
        </p>
        <a
          href="/api/account/export"
          data-testid="export-link"
          className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Download al je data
        </a>
      </section>

      <AccountControls
        initialNotificationsEnabled={user.notificationsEnabled}
        initialOcrTrainingOptIn={user.ocrTrainingOptIn}
      />

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Bank-koppelingen (PSD2)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Koppel je bank zodat we maandelijkse lasten automatisch detecteren.
        </p>
        <Link
          href="/account/banks"
          className="mt-3 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Beheren →
        </Link>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Actieve sessies</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {sessions.length === 0 && <li className="py-2 text-slate-500">Geen actieve sessies.</li>}
          {sessions.map((s) => (
            <li key={s.id} className="py-2 flex justify-between">
              <span className="font-mono text-xs text-slate-500">{s.id.slice(0, 8)}…</span>
              <span className="text-slate-600">verloopt {new Date(s.expires).toLocaleDateString("nl-NL")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="text-lg font-semibold text-rose-900">Account verwijderen (AVG art. 17)</h2>
        <p className="mt-1 text-sm text-rose-800">
          Onomkeerbaar. Je e-mailadres, naam, bills en sessies worden anoniem of verwijderd.
        </p>
        <AccountControls.DeleteForm />
      </section>

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/dashboard" className="underline">← Terug naar dashboard</Link>
      </div>
    </main>
  );
}
