import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatEurCents } from "@/lib/format";
import {
  detectWaste,
  totalPotentialMonthlyCents,
  type WasteBill,
} from "@/lib/waste-detection";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Spookabonnementen — DeGeldHeld",
  description:
    "Bekijk welke mogelijk dubbele of onbenutte abonnementen je hebt — uit je " +
    "eigen rekeningen, met self-cancel-begeleiding. Geen betaalde opzegdienst.",
};

/**
 * v28 DEEL 5 — spookabonnement-detectie + self-cancel-begeleiding.
 * We doen NIET het opzeggen voor je (dat is een bekritiseerde betaalde
 * markt); we maken inzichtelijk en leggen uit hoe je het zelf gratis doet.
 */
export default async function SpookabonnementenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/spookabonnementen");
  const userId = (session.user as { id: string }).id;

  const bills = await prisma.bill.findMany({
    where: { userId },
    select: { id: true, provider: true, category: true, monthlyCents: true, amountCents: true },
  });
  const findings = detectWaste(bills as WasteBill[]);
  const potentialMonthly = totalPotentialMonthlyCents(findings);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12 sm:pt-16">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
        Vind verspilling
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
        Spookabonnementen
      </h1>
      <p className="mt-3 text-slate-700">
        We scannen je geüploade rekeningen op dubbele of onbenutte abonnementen —
        en leggen uit hoe je ze <strong>zelf gratis</strong> opzegt. We doen het
        opzeggen niet voor je, want dat zou gratis-werk in rekening brengen.
      </p>

      {findings.length === 0 ? (
        <section
          data-testid="spook-empty"
          className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            Niets opvallend gevonden
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Op basis van je geüploade rekeningen zien we geen duidelijke dubbele
            of overlappende abonnementen. Upload meer rekeningen om beter
            zicht te krijgen op je vaste lasten.
          </p>
          <Link
            href="/onderhandel"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Upload een rekening →
          </Link>
        </section>
      ) : (
        <>
          {potentialMonthly > 0 ? (
            <section
              data-testid="spook-total"
              className="mt-8 rounded-2xl bg-brand-600 p-6 text-white shadow-sm"
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-50">
                Potentieel
              </p>
              <p className="mt-1 text-3xl font-bold">
                Tot {formatEurCents(potentialMonthly)}/mnd te besparen
              </p>
              <p className="mt-2 text-sm text-brand-50">
                Bovengrens als je het overlap/dubbele opzegt. Reken het stevig na
                voordat je opzegt.
              </p>
            </section>
          ) : null}

          <ul className="mt-8 space-y-4" data-testid="spook-findings">
            {findings.map((f) => (
              <li
                key={f.id}
                data-testid={`spook-finding-${f.kind}`}
                className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                  {f.monthlyTotalCents > 0 ? (
                    <span className="text-sm font-semibold text-brand-700">
                      mogelijk {formatEurCents(f.monthlyTotalCents)}/mnd
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-700">{f.reason}</p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700">
                    Zelf opzeggen — zo doe je dat →
                  </summary>
                  <p className="mt-2 text-sm text-slate-700">{f.cancelGuidance}</p>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        DeGeldHeld biedt géén betaalde opzegdienst. We helpen je het{" "}
        <strong>zelf gratis</strong> te doen — de Consumentenbond bekritiseert
        opzegdiensten die werk in rekening brengen dat je gratis zelf kunt doen.{" "}
        <Link href="/" className="underline">
          Terug naar home
        </Link>
        .
      </footer>
    </main>
  );
}
