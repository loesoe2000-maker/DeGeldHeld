import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { formatEurCents } from "@/lib/format";
import { berekenKalibratie, PUNTEN_TOLERANTIE } from "@/lib/pilot-kalibratie";
import PilotCaseRij from "./PilotCaseRij";

export const dynamic = "force-dynamic";
export const metadata = { title: "Huurprijs-pilot — kalibratie-logboek" };

/**
 * v40 F4 — het kalibratie-logboek. Laat in één oogopslag zien of de
 * huurprijs-check aan mag: gate A (vergelijking met de officiële
 * Huurprijscheck) is de lanceer-gate, gate B (echte uitspraken) loopt door.
 */
export default async function HuurprijsPilotPage() {
  if (!(await isAdmin())) redirect("/dashboard");

  const rows = await prisma.huurprijsPilotCase.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const rapport = berekenKalibratie(rows);

  const gateKaart = (naam: string, g: { gehaald: boolean; redenen: string[] }, uitleg: string) => (
    <div
      className={`rounded-xl border p-5 ${
        g.gehaald ? "border-brand-300 bg-brand-50/50" : "border-amber-300 bg-amber-50/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{g.gehaald ? "✅" : "⏳"}</span>
        <h2 className="font-semibold text-slate-900">{naam}</h2>
      </div>
      <p className="mt-1 text-xs text-slate-600">{uitleg}</p>
      {g.redenen.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-slate-800">
          {g.redenen.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm font-medium text-brand-800">Alles groen.</p>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Huurprijs-pilot</h1>
      <p className="mt-2 text-sm text-slate-600">
        Meet of de check klopt. Draai{" "}
        <Link className="underline" href="/huurprijs-check">
          de check
        </Link>{" "}
        op een echte woning, bewaar hem als proefzaak, en vul hier in wat de{" "}
        <a
          className="underline"
          href="https://huurprijscheck.huurcommissie.nl/zelfstandige-woonruimte"
          target="_blank"
          rel="noopener noreferrer"
        >
          officiële Huurprijscheck
        </a>{" "}
        zegt. Tolerantie: {PUNTEN_TOLERANTIE} punten.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {gateKaart(
          "Gate A — lanceer-gate",
          rapport.gateA,
          "Vergelijking met de officiële Huurprijscheck. Kost geen procedure en geen wachttijd; hier hangt de feature-flag aan.",
        )}
        {gateKaart(
          "Gate B — doorlopend",
          rapport.gateB,
          "Vergelijking met echte uitspraken. Een procedure duurt 4-6 maanden, dus dit loopt door ná de lancering.",
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Proefzaken", String(rapport.aantalCases)],
          ["Officieel gecheckt", String(rapport.aantalMetOfficieel)],
          [
            "Gem. afwijking",
            rapport.gemiddeldAbsoluutVerschil == null
              ? "—"
              : `${rapport.gemiddeldAbsoluutVerschil} pt`,
          ],
          ["Vals-positieven", String(rapport.valsPositieven.length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <p
          data-testid="pilot-leeg"
          className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Nog geen proefzaken. Begin met één echte woning — je eigen huis of dat
          van familie telt volwaardig mee. Draai de check, klik &quot;bewaar als
          proefzaak&quot;, en vul daarna hier de officiële uitkomst in.
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {rows.map((r) => (
            <PilotCaseRij
              key={r.id}
              id={r.id}
              label={r.label}
              onzePunten={r.onzePunten}
              onsVerdict={r.onsVerdict}
              onzeRoute={r.onzeRoute}
              onzeMaxHuur={
                r.onzeMaxHuurCents == null ? "—" : formatEurCents(r.onzeMaxHuurCents)
              }
              kaleHuur={formatEurCents(r.kaleHuurCents)}
              officieelPunten={r.officieelPunten}
              officieelMaxHuurCents={r.officieelMaxHuurCents}
              uitspraakUitkomst={r.uitspraakUitkomst}
              intakeNotitie={r.intakeNotitie}
            />
          ))}
        </div>
      )}
    </main>
  );
}
