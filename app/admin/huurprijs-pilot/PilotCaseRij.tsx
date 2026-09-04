"use client";

import { useState } from "react";

/** Eén proefzaak: onze voorspelling links, de werkelijkheid rechts invulbaar. */
export default function PilotCaseRij(props: {
  id: string;
  label: string;
  onzePunten: number;
  onsVerdict: string;
  onzeRoute: string;
  onzeMaxHuur: string;
  kaleHuur: string;
  officieelPunten: number | null;
  officieelMaxHuurCents: number | null;
  uitspraakUitkomst: string | null;
  intakeNotitie: string | null;
}) {
  const [punten, setPunten] = useState(props.officieelPunten?.toString() ?? "");
  const [maxHuur, setMaxHuur] = useState(
    props.officieelMaxHuurCents == null ? "" : (props.officieelMaxHuurCents / 100).toFixed(2),
  );
  const [uitkomst, setUitkomst] = useState(props.uitspraakUitkomst ?? "");
  const [notitie, setNotitie] = useState(props.intakeNotitie ?? "");
  const [status, setStatus] = useState<string | null>(null);

  const verschil =
    props.officieelPunten == null ? null : props.onzePunten - props.officieelPunten;

  async function opslaan() {
    setStatus("Bezig…");
    const body: Record<string, unknown> = { id: props.id, intakeNotitie: notitie || null };
    if (punten !== "") body.officieelPunten = Math.round(Number(punten));
    if (maxHuur !== "") body.officieelMaxHuurCents = Math.round(Number(maxHuur) * 100);
    if (uitkomst !== "") body.uitspraakUitkomst = uitkomst;
    try {
      const res = await fetch("/api/admin/huurprijs-pilot", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatus(res.ok ? "Opgeslagen — ververs voor de nieuwe gate-stand." : "Mislukt.");
    } catch {
      setStatus("Mislukt (netwerk).");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{props.label}</h3>
        {verschil == null ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            nog niet officieel gecheckt
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              Math.abs(verschil) <= 2
                ? "bg-brand-100 text-brand-800"
                : "bg-rose-100 text-rose-900"
            }`}
          >
            {verschil > 0 ? `+${verschil}` : verschil} punten verschil
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-slate-600">
        Wij: <strong>{props.onzePunten} punten</strong> · max {props.onzeMaxHuur} · huur{" "}
        {props.kaleHuur} · {props.onsVerdict} · {props.onzeRoute}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <input
          value={punten}
          onChange={(e) => setPunten(e.target.value)}
          placeholder="officiële punten"
          type="number"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={maxHuur}
          onChange={(e) => setMaxHuur(e.target.value)}
          placeholder="officiële max huur €"
          type="number"
          step="0.01"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={uitkomst}
          onChange={(e) => setUitkomst(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">uitspraak: nog geen</option>
          <option value="LOPEND">Lopend</option>
          <option value="GEWONNEN">Gewonnen</option>
          <option value="VERLOREN">Verloren</option>
          <option value="GESCHIKT">Geschikt</option>
          <option value="INGETROKKEN">Ingetrokken</option>
        </select>
        <button
          type="button"
          onClick={opslaan}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Opslaan
        </button>
      </div>

      <textarea
        value={notitie}
        onChange={(e) => setNotitie(e.target.value)}
        placeholder="Wat ging er mis of goed in de intake? Snapte de huurder de vragen? Dit is het echte leergeld."
        rows={2}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {status ? <p className="mt-2 text-xs text-slate-600">{status}</p> : null}
    </div>
  );
}
