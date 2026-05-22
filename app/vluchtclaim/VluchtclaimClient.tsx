"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEurCents } from "@/lib/format";
import { track } from "@/lib/analytics";
import type { Eu261Result } from "@/lib/eu261";

/**
 * v28 DEEL 4 — gratis EU261-check UI. Vluchtnummer + datum → POST naar
 * /api/vluchtclaim/check (server-side: flight-data-adapter → eu261Compensation).
 * Geen flight-data-key configured → "binnenkort"-staat (no-data). Geen PII in
 * analytics; vluchtnummer/datum verlaten de browser alléén richting onze eigen
 * server (transient), en daar gaan ze niet in de database.
 */
type CheckResponse =
  | { kind: "found"; result: Eu261Result; flight: { flightNumber: string; date: string } }
  | { kind: "no-data"; reason: string }
  | { kind: "error"; reason: string };

export default function VluchtclaimClient() {
  const [flightNumber, setFlightNumber] = useState("");
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CheckResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResponse(null);
    const fn = flightNumber.trim().replace(/\s+/g, "").toUpperCase();
    if (!fn) {
      setError("Vul je vluchtnummer in, bv. KL1234.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Vul de vluchtdatum in (yyyy-mm-dd).");
      return;
    }
    setPending(true);
    try {
      const r = await fetch("/api/vluchtclaim/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flightNumber: fn, date }),
      });
      const data = (await r.json()) as CheckResponse;
      setResponse(data);
      track("vluchtclaim_checked", {
        kind: data.kind,
        eligible: data.kind === "found" ? data.result.eligible : false,
      });
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12 sm:pt-16">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
        Gratis check — EU261
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
        Was je vlucht vertraagd? Check je recht op € 250–€ 600
      </h1>
      <p className="mt-3 text-slate-700">
        EU-verordening 261/2004: ≥ 3 u vertraagd (of ≥ 4 u op &gt; 3.500 km) → recht
        op € 250 / € 400 / € 600 per persoon. Verjaring 2 jaar. Buitengewone
        omstandigheden (extreem weer, ATC-staking) tellen niet mee.
      </p>

      <form
        onSubmit={onSubmit}
        data-testid="vluchtclaim-form"
        className="mt-6 grid gap-4 sm:grid-cols-2 ph-no-capture"
      >
        <label className="block text-sm">
          <span className="font-semibold text-slate-900">Vluchtnummer</span>
          <input
            type="text"
            value={flightNumber}
            onChange={(e) => setFlightNumber(e.target.value)}
            placeholder="bv. KL1234"
            data-testid="vluchtclaim-flightnumber"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-slate-900">Vluchtdatum</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="vluchtclaim-date"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <div className="sm:col-span-2">
          {error ? (
            <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            data-testid="vluchtclaim-submit"
            className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40 sm:w-auto"
          >
            {pending ? "Bezig…" : "Check mijn vlucht"}
          </button>
        </div>
      </form>

      {response ? <Result response={response} /> : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Indicatie op basis van EU-verordening 261/2004 (verifieerbaar:{" "}
          <a
            href="https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_nl.htm"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Europa.eu
          </a>
          ). Dit is geen advies. Verjaring NL: 2 jaar na de vluchtdatum.
        </p>
      </footer>
    </main>
  );
}

function Result({ response }: { response: CheckResponse }) {
  if (response.kind === "no-data") {
    return (
      <section
        data-testid="vluchtclaim-no-data"
        className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"
      >
        <h2 className="text-lg font-semibold text-amber-900">
          We staan klaar — flight-data-koppeling komt binnenkort
        </h2>
        <p className="mt-1 text-sm text-amber-900">
          De automatische check werkt zodra de eigenaar de officiële
          flight-data-koppeling + jurist-akkoord heeft afgerond. Wil je dat we
          alvast contact opnemen? Stuur ons je vluchtnummer + datum.
        </p>
        <a
          href={`mailto:hallo@degeldheld.com?subject=Vluchtclaim%20EU261%20%E2%80%94%20handmatige%20check`}
          data-testid="vluchtclaim-waitlist"
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Mail ons voor een handmatige check →
        </a>
      </section>
    );
  }
  if (response.kind === "error") {
    return (
      <section
        data-testid="vluchtclaim-error"
        className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6"
      >
        <h2 className="text-lg font-semibold text-rose-900">Er ging iets mis</h2>
        <p className="mt-1 text-sm text-rose-900">
          {response.reason || "Probeer het later opnieuw."}
        </p>
      </section>
    );
  }
  const { result, flight } = response;
  return (
    <section
      data-testid="vluchtclaim-result"
      className={`mt-8 rounded-2xl border p-6 ${
        result.eligible ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
        Indicatie · {flight.flightNumber} · {flight.date}
      </p>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {result.eligible ? `Mogelijk € ${formatEurCents(result.amountCents)} compensatie` : "Geen evident recht op compensatie"}
      </p>
      <p className="mt-2 text-sm text-slate-700">{result.reden}</p>

      {result.eligible ? (
        <div className="mt-4">
          <a
            href={`mailto:hallo@degeldheld.com?subject=Vluchtclaim%20EU261%20%E2%80%94%20${encodeURIComponent(flight.flightNumber)}%20${encodeURIComponent(flight.date)}`}
            data-testid="vluchtclaim-start-claim"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Start claim — no cure, no pay →
          </a>
          <p className="mt-2 text-xs text-slate-500">
            No cure, no pay: alleen áls we het bedrag terughalen, betaal je een
            % van het teruggehaalde geld. Niets vooruit, geen lock-in.
          </p>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        Dit is een indicatie, geen advies of toezegging. Definitief recht hangt af van de
        oorzaak (buitengewone omstandigheid?) en bewijs.{" "}
        <Link href="/" className="underline">
          Terug naar home
        </Link>
        .
      </p>
    </section>
  );
}
