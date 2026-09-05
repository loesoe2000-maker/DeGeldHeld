"use client";

/**
 * /huurcommissie-check — V35 DEEL 1 — gratis Huurcommissie-bezwaar-check.
 *
 * Privacy-by-design: alle berekening draait CLIENT-SIDE in
 * `estimateHuurServicekostenRestitutie`. Voorschot-bedragen, werkelijke kosten
 * en huurcontract-vlaggen verlaten de browser NIET. PostHog krijgt alleen
 * booleans/counts (geen PII).
 *
 * v41 — GRATIS PLATFORM: de oude € 50-drempel bepaalde of een fee loonde.
 * Er is geen fee meer; iedereen krijgt hetzelfde aanbod.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseEurInput, formatEurCents } from "@/lib/format";
import {
  estimateHuurServicekostenRestitutie,
  huurBezwaarBrief,
  HUUR_DISCLAIMER,
  HUURCOMMISSIE_PEILDATUM,
  HUUR_NCNP_DREMPEL_CENTS,
  HUURCOMMISSIE_LEGES_CENTS,
  type HuurRodeVlaggen,
  type HuurServicekostenInput,
  type HuurServicekostenResult,
} from "@/lib/huurcommissie";
import { track } from "@/lib/analytics";
import PostCheckCta from "@/components/PostCheckCta";

const SUPPORTED_BOEKJAREN = [2025, 2024, 2023, 2022, 2021, 2020] as const;

const STATUS_STYLES: Record<HuurServicekostenResult["status"], { pill: string; label: string; card: string }> = {
  likely: {
    pill: "bg-brand-100 text-brand-800",
    label: "Bezwaar loont waarschijnlijk",
    card: "border-brand-200 bg-brand-50/40",
  },
  maybe: {
    pill: "bg-amber-100 text-amber-900",
    label: "Mogelijk grond — controleer rode vlaggen",
    card: "border-amber-200 bg-amber-50/40",
  },
  unlikely: {
    pill: "bg-slate-100 text-slate-600",
    label: "Geen evidente bezwaar-grond",
    card: "border-slate-200 bg-white",
  },
};

const VLAG_LABELS: Record<keyof HuurRodeVlaggen, string> = {
  geenSpecificatie: "Geen specificatie per post (alleen één totaalbedrag)",
  geenFacturen: "Geen onderliggende facturen ondanks verzoek",
  postenNietInContract: "Posten die niet in mijn huurcontract staan",
  eigenaarslastenVerrekend: "Eigenaarslasten verrekend (OZB / opstal / vervanging)",
  verhuurderGeenAfrekening: "Verhuurder stuurde géén eindafrekening (wettelijke deadline verstreken)",
  voorschotVeelGroterDanWerkelijk: "Voorschot was duidelijk hoger dan werkelijke kosten",
};

export default function HuurcommissieCheckClient() {
  const [boekjaar, setBoekjaar] = useState<number>(2024);
  const [voorschot, setVoorschot] = useState("");
  const [werkelijk, setWerkelijk] = useState("");
  const [verhuurder, setVerhuurder] = useState("");
  const [vlaggen, setVlaggen] = useState<HuurRodeVlaggen>({
    geenSpecificatie: false,
    geenFacturen: false,
    postenNietInContract: false,
    eigenaarslastenVerrekend: false,
    verhuurderGeenAfrekening: false,
    voorschotVeelGroterDanWerkelijk: false,
  });
  const [result, setResult] = useState<HuurServicekostenResult | null>(null);
  const [input, setInput] = useState<HuurServicekostenInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  useEffect(() => {
    track("huurcommissie_check_started");
  }, []);

  function toggleVlag(key: keyof HuurRodeVlaggen): void {
    setVlaggen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = parseEurInput(voorschot);
    if (v == null) {
      setError("Vul je totale voorschot-bedragen over het boekjaar in (bv. 1.200).");
      return;
    }
    const w = parseEurInput(werkelijk) ?? 0;
    const inp: HuurServicekostenInput = {
      boekjaar,
      voorschotTotaalCents: v,
      werkelijkeKostenTotaalCents: w,
      rodeVlaggen: vlaggen,
      verhuurderNaam: verhuurder.trim() || undefined,
    };
    const r = estimateHuurServicekostenRestitutie(inp);
    setInput(inp);
    setResult(r);
    track("huurcommissie_results_viewed", {
      boekjaar,
      status: r.status,
      rodeVlaggenAantal: r.rodeVlaggenAantal,
      biedNcnpAan: r.biedNcnpAan,
      verwachteRange: r.verwachteRestitutieCents >= HUUR_NCNP_DREMPEL_CENTS ? "ge_50" : "lt_50",
    });
    setTimeout(() => {
      document.getElementById("huur-results")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Huurcommissie — bezwaar servicekosten
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Loont een bezwaar tegen je servicekosten-afrekening?
        </h1>
        <p className="mt-3 text-slate-600">
          Verhuurders moeten elke {/* bron: art. 7:259 BW */} 6 maanden na het boekjaar een
          gespecificeerde eindafrekening sturen. Klopt 'm niet? Gratis indicatie op
          de officiële Huurcommissie-rode-vlaggen. Je gegevens blijven in je browser
          — we slaan niets op.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong className="font-semibold text-slate-900">Privacy:</strong> deze
        check rekent in je eigen browser. Voorschot-bedragen, werkelijke kosten en
        je rode-vlaggen-antwoorden worden niet verstuurd of opgeslagen. Indicatie ≠
        advies — de Huurcommissie bepaalt het exacte bedrag.
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 ph-no-capture">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Boekjaar afrekening</legend>
          <select
            value={boekjaar}
            onChange={(e) => setBoekjaar(Number(e.target.value))}
            data-testid="huur-boekjaar"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-1/2"
          >
            {SUPPORTED_BOEKJAREN.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">
              Totaal voorschot servicekosten dat jaar
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={voorschot}
              onChange={(e) => setVoorschot(e.target.value)}
              placeholder="bv. 1.200"
              data-testid="huur-voorschot"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Som van wat je per maand aan servicekosten-voorschot betaalde, ×12.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">
              Werkelijke kosten volgens afrekening
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={werkelijk}
              onChange={(e) => setWerkelijk(e.target.value)}
              placeholder="bv. 950"
              data-testid="huur-werkelijk"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Het totaal-bedrag dat de verhuurder als "werkelijke kosten" op de
              afrekening zet. Laat leeg/0 als je géén afrekening hebt gekregen.
            </span>
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-semibold text-slate-900">Naam verhuurder (optioneel)</span>
          <input
            type="text"
            value={verhuurder}
            onChange={(e) => setVerhuurder(e.target.value)}
            placeholder="bv. Vesteda, particulier, woningcorporatie"
            data-testid="huur-verhuurder"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-1/2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Alleen voor de DIY-brief-aanhef. Niet opgeslagen tenzij je onze hulp inschakelt.
          </span>
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">
            Rode vlaggen — wat klopt er bij jou?
          </legend>
          <p className="mt-1 text-xs text-slate-500">
            Vink aan wat van toepassing is. Hoe meer vlaggen, hoe sterker je
            positie bij de Huurcommissie.
          </p>
          <div className="mt-3 space-y-2">
            {(Object.keys(VLAG_LABELS) as (keyof HuurRodeVlaggen)[]).map((k) => (
              <label
                key={k}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={vlaggen[k]}
                  onChange={() => toggleVlag(k)}
                  data-testid={`huur-vlag-${k}`}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>{VLAG_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          data-testid="huur-submit"
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
        >
          Bereken indicatie
        </button>
      </form>

      {result && input ? (
        <Results
          result={result}
          input={input}
          briefOpen={briefOpen}
          setBriefOpen={setBriefOpen}
        />
      ) : null}
      {result ? (
        <PostCheckCta
          fromCheck="huurcommissie"
          vondstCents={result.verwachteRestitutieCents > 0 ? result.verwachteRestitutieCents : null}
          vondstLabel="verwachte restitutie"
        />
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Peildatum {HUURCOMMISSIE_PEILDATUM} · procedures + leges{" "}
          <Link href="/voorwaarden" className="underline">
            gesourcet
          </Link>{" "}
          uit Huurcommissie + Beleidsboek Servicekosten januari 2026. Indicatie ≠ advies.
        </p>
      </footer>
    </main>
  );
}

function Results({
  result,
  input,
  briefOpen,
  setBriefOpen,
}: {
  result: HuurServicekostenResult;
  input: HuurServicekostenInput;
  briefOpen: boolean;
  setBriefOpen: (v: boolean) => void;
}) {
  const s = STATUS_STYLES[result.status];
  const verwacht =
    result.verwachteRestitutieCents > 0
      ? formatEurCents(result.verwachteRestitutieCents)
      : null;
  const [ncnpState, setNcnpState] = useState<
    | { kind: "idle" }
    | { kind: "pending" }
    | { kind: "ok"; message: string }
    | { kind: "auth" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function startNcnpClaim() {
    if (ncnpState.kind === "pending") return;
    setNcnpState({ kind: "pending" });
    try {
      const r = await fetch("/api/huurcommissie/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          boekjaar: result.boekjaar,
          verwachteRestitutieCents: result.verwachteRestitutieCents,
          verhuurderNaam: input.verhuurderNaam ?? null,
        }),
      });
      if (r.status === 401) {
        setNcnpState({ kind: "auth" });
        return;
      }
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
      };
      if (!r.ok || !data.ok) {
        setNcnpState({
          kind: "error",
          message:
            data.reason === "below-ncnp-threshold"
              ? "Verwachte restitutie onder € 50 — gebruik het DIY-pad."
              : "Kon claim niet opslaan — probeer het opnieuw.",
        });
        return;
      }
      setNcnpState({
        kind: "ok",
        message:
          "Top — we hebben je een mail gestuurd met de volgende stappen + upload-link " +
          "voor zodra de Huurcommissie-uitspraak binnen is.",
      });
    } catch {
      setNcnpState({ kind: "error", message: "Netwerkfout — probeer het opnieuw." });
    }
  }

  return (
    <section id="huur-results" className={`mt-10 scroll-mt-12 rounded-2xl border p-6 ${s.card}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Indicatie {result.boekjaar}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill}`}>
          {s.label}
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {verwacht
          ? `Bovengrens-indicatie restitutie: ${verwacht}`
          : "Geen evidente bezwaar-grond"}
      </p>
      <p className="mt-2 text-sm text-slate-700">{result.uitleg}</p>

      <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs text-slate-700">
        <p>
          <strong>Wettelijke deadlines:</strong>
        </p>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          <li>
            Eindafrekening had verhuurder uiterlijk{" "}
            <strong>{result.deadlinesContext.wettelijkeAfrekeningDeadline}</strong> moeten sturen.
          </li>
          <li>
            Bezwaar bij Huurcommissie kan tot{" "}
            <strong>{result.deadlinesContext.bezwaarDeadlineHuurcommissie}</strong>.
          </li>
          <li>
            Huurcommissie-leges: € {(HUURCOMMISSIE_LEGES_CENTS / 100).toLocaleString("nl-NL")} —
            terug bij winst.
          </li>
        </ul>
      </div>

      {result.biedNcnpAan ? (
        <div
          data-testid="huur-ncnp-card"
          className="mt-6 rounded-xl border border-brand-300 bg-white p-5"
        >
          <h3 className="text-lg font-semibold text-slate-900">
            Wij stellen het bezwaar voor je op
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            We stellen het bezwaartraject voor je op. Aan onze hulp zijn geen
            kosten verbonden. Let op: de Huurcommissie zelf vraagt
            € 25 leges — dat bedrag gaat naar hen en krijg je terug als je wint.
            Liever zelf doen? Hieronder staat dezelfde brief om zelf te sturen.
          </p>
          <button
            type="button"
            data-testid="huur-ncnp-cta"
            disabled={ncnpState.kind === "pending" || ncnpState.kind === "ok"}
            onClick={() => {
              track("huurcommissie_ncnp_chosen", { boekjaar: result.boekjaar });
              void startNcnpClaim();
            }}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40"
          >
            {ncnpState.kind === "pending"
              ? "Bezig…"
              : ncnpState.kind === "ok"
                ? "Verstuurd ✓"
                : "Start — wij regelen het bezwaar →"}
          </button>
          {ncnpState.kind === "ok" ? (
            <p data-testid="huur-ncnp-ok" className="mt-2 text-sm text-brand-800">
              {ncnpState.message}
            </p>
          ) : null}
          {ncnpState.kind === "auth" ? (
            <p data-testid="huur-ncnp-auth" className="mt-2 text-sm text-rose-700">
              Log eerst in om de claim aan te maken —{" "}
              <a href="/login" className="underline">
                inloggen
              </a>
              .
            </p>
          ) : null}
          {ncnpState.kind === "error" ? (
            <p data-testid="huur-ncnp-error" className="mt-2 text-sm text-rose-700">
              {ncnpState.message}
            </p>
          ) : null}
        </div>
      ) : (
        result.verwachteRestitutieCents > 0 ? (
          <div
            data-testid="huur-diy-only-card"
            className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
          >
            <h3 className="text-lg font-semibold text-slate-900">
              Doe 't lekker zelf — gratis
            </h3>
            <p className="mt-1 text-sm text-slate-700">
              Alles wat we doen is gratis, ongeacht het bedrag.</p>
          </div>
        ) : null
      )}

      <div className="mt-6">
        <button
          type="button"
          data-testid="huur-diy-toggle"
          onClick={() => {
            setBriefOpen(!briefOpen);
            if (!briefOpen) track("huurcommissie_diy_chosen", { boekjaar: result.boekjaar });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {briefOpen ? "Verberg DIY-brief" : "Toon DIY-brief (gratis)"}
        </button>
        {briefOpen ? (
          <pre
            data-testid="huur-diy-brief"
            className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-800"
          >
            {huurBezwaarBrief(input, result)}
          </pre>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        {HUUR_DISCLAIMER}
      </p>
    </section>
  );
}
