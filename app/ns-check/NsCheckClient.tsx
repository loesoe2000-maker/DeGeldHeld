"use client";

/**
 * /ns-check — gratis NS Geld-Terug bij Vertraging check + brief-template.
 *
 * Privacy: pure berekening in `nsCompensation` draait CLIENT-SIDE.
 * Plus-upsell: "auto-claim elke vertraging" is een pijler in /plus.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseEurInput, formatEurCents } from "@/lib/format";
import {
  nsCompensation,
  nsClaimBrief,
  NS_DISCLAIMER,
  NS_PEILDATUM,
  type NsInput,
  type NsResult,
} from "@/lib/ns";
import { track } from "@/lib/analytics";

export default function NsCheckClient() {
  const [ticket, setTicket] = useState("");
  const [delay, setDelay] = useState("");
  const [date, setDate] = useState("");
  const [route, setRoute] = useState("");
  const [tipo, setTipo] = useState<"binnenland" | "international" | "abonnement" | "vrijflex">("binnenland");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NsResult | null>(null);
  const [input, setInput] = useState<NsInput | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  useEffect(() => {
    track("ns_check_started");
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const t = parseEurInput(ticket);
    if (t == null || t < 0) {
      setError("Vul de ticketprijs in (bv. 12,50).");
      return;
    }
    const d = Number(delay);
    if (!Number.isFinite(d) || d < 0 || d > 12 * 60) {
      setError("Vul de vertraging in minuten in (bv. 45).");
      return;
    }
    const inp: NsInput = {
      ticketCents: t,
      delayMinutes: d,
      isAbonnement: tipo === "abonnement",
      isVrijOfFlex: tipo === "vrijflex",
      isInternational: tipo === "international",
    };
    const r = nsCompensation(inp);
    setInput(inp);
    setResult(r);
    track("ns_results_viewed", {
      regime: r.regime,
      eligible: r.eligible,
      belowMinimum: r.belowMinimum,
      delayBand:
        d >= 120 ? "ge_120" : d >= 60 ? "60_119" : d >= 30 ? "30_59" : d >= 15 ? "15_29" : "lt_15",
    });
    setTimeout(() => {
      document.getElementById("ns-results")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          NS Geld-Terug bij Vertraging
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Trein vertraagd? Check je recht op compensatie
        </h1>
        <p className="mt-3 text-slate-600">
          Gratis indicatie op de NS-voorwaarden en EU-PRR (Verordening 2021/782).
          ≥ 30 minuten op binnenland → 50%, ≥ 60 minuten → 100%. We claimen
          niet voor je — wel geven we je een brief-template.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong className="font-semibold text-slate-900">Privacy:</strong> deze
        check rekent in je eigen browser. Ticket + vertraging + route worden
        niet verstuurd of opgeslagen.
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 ph-no-capture">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Type reis</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { v: "binnenland", l: "Binnenland (losse ticket)" },
                { v: "international", l: "Internationaal / IC-direct" },
                { v: "abonnement", l: "Met kortings-/toeslagabonnement" },
                { v: "vrijflex", l: "Vrij Reizen / NS-Flex" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.v}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
                  tipo === opt.v
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-300 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={opt.v}
                  checked={tipo === opt.v}
                  onChange={() => setTipo(opt.v)}
                  className="sr-only"
                />
                {opt.l}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Ticketprijs (enkele reis)</span>
            <input
              type="text"
              inputMode="decimal"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="bv. 12,50"
              data-testid="ns-ticket"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {tipo === "vrijflex" ? (
              <span className="mt-1 block text-xs text-slate-500">
                Bij Vrij-/Flex-abonnement bepaalt Mijn NS het exacte bedrag.
              </span>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Vertraging op eindbestemming (minuten)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={720}
              value={delay}
              onChange={(e) => setDelay(e.target.value)}
              placeholder="bv. 45"
              data-testid="ns-delay"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Datum (optioneel)</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="ns-date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              max={new Date().toISOString().slice(0, 10)}
            />
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Route (optioneel)</span>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="bv. Amsterdam Centraal → Utrecht"
              data-testid="ns-route"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          data-testid="ns-submit"
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
        >
          Bereken compensatie
        </button>
      </form>

      {result && input ? (
        <Results
          result={result}
          input={input}
          date={date}
          route={route}
          briefOpen={briefOpen}
          setBriefOpen={setBriefOpen}
        />
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        Peildatum {NS_PEILDATUM} · regels{" "}
        <Link href="/voorwaarden" className="underline">gesourcet</Link>{" "}
        uit NS-voorwaarden + EU-PRR Verordening 2021/782. Indicatie ≠ advies.
      </footer>
    </main>
  );
}

function Results({
  result,
  input,
  date,
  route,
  briefOpen,
  setBriefOpen,
}: {
  result: NsResult;
  input: NsInput;
  date: string;
  route: string;
  briefOpen: boolean;
  setBriefOpen: (v: boolean) => void;
}) {
  const isVerwijs = result.regime === "ABONNEMENT_VERWIJS";

  return (
    <section
      id="ns-results"
      data-testid="ns-results"
      className={`mt-10 scroll-mt-12 rounded-2xl border p-6 ${
        result.eligible && !result.belowMinimum
          ? "border-brand-200 bg-brand-50/40"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
        Indicatie
      </p>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {isVerwijs
          ? "Bedrag verschilt per Vrij-/Flex-abonnement"
          : result.eligible && !result.belowMinimum
            ? `Tot ${formatEurCents(result.compensationCents)} terug (${result.percentage}%)`
            : result.belowMinimum
              ? "Onder de minimum-claim van € 2,30"
              : "Geen evident recht op compensatie"}
      </p>
      <p className="mt-2 text-sm text-slate-700">{result.reden}</p>
      <p className="mt-2 text-sm text-slate-700">
        <strong>Deadline:</strong> dien binnen {result.deadlineDagen} dagen in via{" "}
        <a className="underline" href="https://www.ns.nl/klantenservice" target="_blank" rel="noopener noreferrer">
          Mijn NS of het ns.nl-formulier
        </a>
        .
      </p>

      {result.eligible || isVerwijs ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="ns-brief-toggle"
            onClick={() => setBriefOpen(!briefOpen)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {briefOpen ? "Verberg brief-template" : "Toon brief-template"}
          </button>
          <a
            href={`mailto:hallo@degeldheld.com?subject=Reminder%20NS-claim%20${encodeURIComponent(date || "[datum]")}&body=${encodeURIComponent("Zet me op de deadline voor mijn NS-claim. Datum vertraging: " + (date || "[invullen]"))}`}
            data-testid="ns-reminder"
            onClick={() => track("ns_reminder_set")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Zet me op de deadline (mail) →
          </a>
        </div>
      ) : null}

      {briefOpen ? (
        <pre
          data-testid="ns-brief"
          className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-800"
        >
          {nsClaimBrief(input, result, { dateISO: date || undefined, route: route || undefined })}
        </pre>
      ) : null}

      {/* Plus-upsell: auto-claim elke vertraging — de echte revenue-route. */}
      <div
        data-testid="ns-plus-upsell"
        className="mt-6 rounded-xl border border-brand-300 bg-white p-5"
      >
        <h3 className="text-lg font-semibold text-slate-900">
          Liever automatisch claimen bij élke vertraging?
        </h3>
        <p className="mt-1 text-sm text-slate-700">
          DeGeldHeld Plus scant maandelijks je reizen en herinnert je aan elke
          claim — zodat je niet meer hoeft op te letten of de deadline te
          missen.
        </p>
        <Link
          href="/plus"
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Bekijk DeGeldHeld Plus →
        </Link>
      </div>

      <p className="mt-6 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        {NS_DISCLAIMER}
      </p>
    </section>
  );
}
