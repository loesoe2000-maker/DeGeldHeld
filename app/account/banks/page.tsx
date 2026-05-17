import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isPsd2Enabled } from "@/lib/psd2/tink";
import Link from "next/link";
import BanksClient from "@/components/BanksClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bank-koppelingen — DeGeldHeld" };

export default async function BanksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/account/banks");
  const userId = (session.user as { id: string }).id;

  const enabled = isPsd2Enabled();
  const connections = enabled
    ? await prisma.bankConnection.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const detected = enabled
    ? await prisma.detectedRecurring.findMany({
        where: { userId, convertedBillId: null },
        orderBy: { lastSeenAt: "desc" },
        take: 30,
      })
    : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-slate-500">DeGeldHeld → Account → Banken</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Bank-koppelingen</h1>
      <p className="mt-2 text-sm text-slate-600">
        Koppel je bank via Tink (PSD2) — wij ontdekken automatisch terugkerende lasten en stellen onderhandelingen voor.
      </p>

      {!enabled && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900" data-testid="psd2-disabled">
          <strong>PSD2 nog niet geactiveerd.</strong> Tink-account, DPIA en
          verwerkers­overeenkomst zijn nog niet rond. Zie{" "}
          <a href="https://github.com/loesoe2000-maker/DeGeldHeld" className="underline">MANUAL_SETUP_REQUIRED.md</a> in de
          repo voor de stappen. Zodra <code>PSD2_ENABLED=true</code> in
          Vercel staat, kun je hier banken koppelen.
        </div>
      )}

      {enabled && (
        <>
          <BanksClient hasConnection={connections.length > 0} />

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Actieve koppelingen</h2>
            {connections.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nog geen bank gekoppeld.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {connections.map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-4 text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">{c.bankName}</div>
                      <div className="text-xs text-slate-500">
                        Status: {c.status} · {c.lastSyncAt ? `Laatste sync ${new Date(c.lastSyncAt).toLocaleDateString("nl-NL")}` : "Nog niet gesynct"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Gedetecteerde maandelijkse lasten</h2>
            {detected.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nog niets gedetecteerd. Synct kan tot 24u duren.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {detected.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">{d.counterpartyName}</div>
                      <div className="text-xs text-slate-500">
                        €{(d.monthlyCents / 100).toFixed(2).replace(".", ",")}/mnd · {d.category} · {d.occurrences} keer gezien
                      </div>
                    </div>
                    <Link
                      href={`/onderhandel?prefill=${encodeURIComponent(d.counterpartyName)}`}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      Maak onderhandeling →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/account" className="underline">← Terug naar account</Link>
      </div>
    </main>
  );
}
