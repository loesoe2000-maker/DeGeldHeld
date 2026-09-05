"use client";

/**
 * /box3-check — gratis Box 3-rechtsherstel-check.
 *
 * Privacy-by-design: alle berekening draait CLIENT-SIDE in `estimateBox3Restitution`.
 * Banktegoeden / overige bezittingen / schulden / werkelijk rendement verlaten de
 * browser NIET. PostHog krijgt alleen booleans/counts (geen PII).
 *
 * Revenue-gate (uit guardrail 5 v29-sprint): NCNP-aanbod alléén bij verwachte
 * teruggave ≥ € 500 — anders DIY-brief gratis.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseEurInput, formatEurCents } from "@/lib/format";
import {
  estimateBox3Restitution,
  box3DiyBrief,
  BOX3_DISCLAIMER,
  BOX3_PEILDATUM,
  BOX3_NCNP_DREMPEL_CENTS,
  type Box3Huishouden,
  type Box3Input,
  type Box3Result,
} from "@/lib/box3";
// NCNP-aanvraag (OWR via DeGeldHeld) kan alléén voor reeds definitief
// aangeslagen jaren (t/m BOX3_MAX_JAAR). 2025/2026 wél indicatie tonen, maar
// géén NCNP-knop — de API zou die afwijzen met reason:invalid-jaar.
import { BOX3_MAX_JAAR } from "@/lib/box3-claim";
import { track } from "@/lib/analytics";
import PostCheckCta from "@/components/PostCheckCta";

const SUPPORTED_JAREN = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017] as const;

const STATUS_STYLES: Record<Box3Result["status"], { pill: string; label: string; card: string }> = {
  likely: {
    pill: "bg-brand-100 text-brand-800",
    label: "OWR loont waarschijnlijk",
    card: "border-brand-200 bg-brand-50/40",
  },
  maybe: {
    pill: "bg-amber-100 text-amber-900",
    label: "Mogelijk recht — vul werkelijk rendement in",
    card: "border-amber-200 bg-amber-50/40",
  },
  unlikely: {
    pill: "bg-slate-100 text-slate-600",
    label: "Geen evident recht op vermindering",
    card: "border-slate-200 bg-white",
  },
};

export default function Box3CheckClient() {
  const [jaar, setJaar] = useState<number>(2024);
  const [huishouden, setHuishouden] = useState<Box3Huishouden>("alleenstaand");
  const [bank, setBank] = useState("");
  const [overig, setOverig] = useState("");
  const [schulden, setSchulden] = useState("");
  const [werkelijk, setWerkelijk] = useState("");
  const [result, setResult] = useState<Box3Result | null>(null);
  const [input, setInput] = useState<Box3Input | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  useEffect(() => {
    track("box3_check_started");
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const b = parseEurInput(bank);
    if (b == null) {
      setError("Vul je banktegoeden / spaargeld in (bv. 25.000).");
      return;
    }
    const o = parseEurInput(overig) ?? 0;
    const s = parseEurInput(schulden) ?? 0;
    const w =
      werkelijk.trim() === ""
        ? undefined
        : (() => {
            // parseEurInput werkt voor positieve waarden; werkelijk rendement
            // mag negatief (koersverlies). Sta '-' aan het begin toe.
            const trimmed = werkelijk.trim();
            const neg = trimmed.startsWith("-");
            const v = parseEurInput(neg ? trimmed.slice(1) : trimmed);
            return v == null ? undefined : neg ? -v : v;
          })();
    const inp: Box3Input = {
      jaar,
      huishouden,
      banktegoedenCents: b,
      overigeBezittingenCents: o,
      schuldenCents: s,
      werkelijkRendementCents: w,
    };
    const r = estimateBox3Restitution(inp);
    setInput(inp);
    setResult(r);
    track("box3_results_viewed", {
      jaar,
      huishouden,
      hasWerkelijk: w != null,
      status: r.status,
      biedNcnpAan: r.biedNcnpAan,
      verwachteRange:
        r.verwachteTeruggaveCents >= BOX3_NCNP_DREMPEL_CENTS ? "ge_500" : "lt_500",
    });
    setTimeout(() => {
      document.getElementById("box3-results")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Box 3 — Wet tegenbewijsregeling
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Loont een rechtsherstel-verzoek voor jouw box 3-jaar?
        </h1>
        <p className="mt-3 text-slate-600">
          Sinds 19 juli 2025 mag je vragen om vermindering als je werkelijke
          rendement lager was dan het forfaitaire rendement. Gratis indicatie op de
          officiële Belastingdienst-forfaits (2017-2026). Je gegevens blijven in
          je browser — we slaan niets op.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong className="font-semibold text-slate-900">Privacy:</strong> deze
        check rekent in je eigen browser. Banktegoeden, beleggingen en schulden
        worden niet verstuurd of opgeslagen. Indicatie ≠ advies — de
        Belastingdienst bepaalt het exacte bedrag via het OWR-formulier.
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 ph-no-capture">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Belastingjaar</legend>
          <select
            value={jaar}
            onChange={(e) => setJaar(Number(e.target.value))}
            data-testid="box3-jaar"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-1/2"
          >
            {SUPPORTED_JAREN.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Huishouden</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["alleenstaand", "met_partner"] as Box3Huishouden[]).map((h) => (
              <label
                key={h}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
                  huishouden === h
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-300 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="huishouden"
                  value={h}
                  checked={huishouden === h}
                  onChange={() => setHuishouden(h)}
                  className="sr-only"
                />
                {h === "alleenstaand" ? "Alleenstaand" : "Met fiscaal partner"}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Banktegoeden + spaargeld (1-1)</span>
            <input
              type="text"
              inputMode="decimal"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="bv. 25.000"
              data-testid="box3-bank"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Overige bezittingen</span>
            <input
              type="text"
              inputMode="decimal"
              value={overig}
              onChange={(e) => setOverig(e.target.value)}
              placeholder="bv. 50.000 (beleggingen, vastgoed niet-eigen-woning)"
              data-testid="box3-overig"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Schulden (totaal)</span>
            <input
              type="text"
              inputMode="decimal"
              value={schulden}
              onChange={(e) => setSchulden(e.target.value)}
              placeholder="bv. 5.000"
              data-testid="box3-schulden"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Schulden tellen pas mee boven de drempel (€ 3.800 in 2026).
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">
              Werkelijk rendement {jaar} (optioneel)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={werkelijk}
              onChange={(e) => setWerkelijk(e.target.value)}
              placeholder="bv. 1.500 of -2.000 bij verlies"
              data-testid="box3-werkelijk"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Interest spaar + dividend + koersresultaat ± kosten. Negatief mag.
            </span>
          </label>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          data-testid="box3-submit"
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
          fromCheck="box3"
          vondstCents={result.verwachteTeruggaveCents > 0 ? result.verwachteTeruggaveCents : null}
          vondstLabel="verwachte teruggave"
        />
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Peildatum {BOX3_PEILDATUM} · forfaits + heffingsvrij vermogen{" "}
          <Link href="/voorwaarden" className="underline">
            gesourcet
          </Link>{" "}
          uit Belastingdienst / Rijksoverheid. Indicatie ≠ advies.
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
  result: Box3Result;
  input: Box3Input;
  briefOpen: boolean;
  setBriefOpen: (v: boolean) => void;
}) {
  const s = STATUS_STYLES[result.status];
  const verwacht =
    result.verwachteTeruggaveCents > 0
      ? formatEurCents(result.verwachteTeruggaveCents)
      : null;
  // NCNP alléén voor jaren die we daadwerkelijk kunnen aanvragen (≤ MAX_JAAR).
  // 2025/2026 zijn nog niet definitief aangeslagen → wel indicatie, geen knop.
  const ncnpBeschikbaarVoorJaar = result.jaar <= BOX3_MAX_JAAR;
  const jaarNogNietAanvraagbaar = result.biedNcnpAan && !ncnpBeschikbaarVoorJaar;
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
      const r = await fetch("/api/box3/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jaar: result.jaar,
          verwachteTeruggaveCents: result.verwachteTeruggaveCents,
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
              ? "Verwachte teruggave onder € 500 — gebruik het DIY-pad."
              : "Kon claim niet opslaan — probeer het opnieuw.",
        });
        return;
      }
      track("box3_claim_created", { jaar: result.jaar });
      setNcnpState({
        kind: "ok",
        message:
          "Top — we hebben je een mail gestuurd met de upload-link voor zodra je " +
          "Belastingdienst-beschikking binnen is.",
      });
    } catch {
      setNcnpState({ kind: "error", message: "Netwerkfout — probeer het opnieuw." });
    }
  }

  return (
    <section id="box3-results" className={`mt-10 scroll-mt-12 rounded-2xl border p-6 ${s.card}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Indicatie {result.jaar}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill}`}>
          {s.label}
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {verwacht
          ? `Geschatte vermindering: tot ${verwacht}`
          : "Geen evident voordeel uit OWR voor dit jaar"}
      </p>
      <p className="mt-2 text-sm text-slate-700">{result.uitleg}</p>
      {result.deadline ? (
        <p className="mt-2 text-sm text-slate-700">
          <strong>Deadline:</strong> {result.deadline}
        </p>
      ) : null}

      {jaarNogNietAanvraagbaar ? (
        <div
          data-testid="box3-jaar-nog-niet"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5"
        >
          <h3 className="text-lg font-semibold text-amber-900">
            {result.jaar} kun je nog niet via ons aanvragen
          </h3>
          <p className="mt-1 text-sm text-amber-900">
            Je indicatie hierboven klopt, maar belastingjaar {result.jaar} is nog
            niet definitief aangeslagen door de Belastingdienst. Rechtsherstel
            (OWR) vraag je pas aan ná je definitieve aanslag — wij kunnen dit
            voor je doen vanaf belastingjaar {BOX3_MAX_JAAR} en eerder. Kom terug
            zodra je aanslag {result.jaar} binnen is, of doe alvast de check voor
            een eerder jaar.
          </p>
        </div>
      ) : null}

      {result.biedNcnpAan && ncnpBeschikbaarVoorJaar ? (
        <div
          data-testid="box3-ncnp-card"
          className="mt-6 rounded-xl border border-brand-300 bg-white p-5"
        >
          <h3 className="text-lg font-semibold text-slate-900">
            Wij doen het OWR voor je — gratis
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            We stellen de Opgaaf Werkelijk Rendement voor je op. Dat kost je
            <strong> niets</strong> — DeGeldHeld is volledig gratis. Het geld
            gaat rechtstreeks van de Belastingdienst naar jou; wij zitten er
            niet tussen. Liever zelf doen? Hieronder staat dezelfde brief.
          </p>

          <details className="mt-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-800">
              Wat doen wij precies voor je?
            </summary>
            <div className="mt-3 space-y-3 text-slate-700">
              <p>
                <strong>Wat WIJ doen:</strong>
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  <strong>Loont het?</strong> Onze engine schat vooraf of een OWR
                  voor jouw situatie zinvol is (forfaitair vs. werkelijk
                  rendement, sourced uit Belastingdienst-forfaits 2017-2026).
                </li>
                <li>
                  <strong>Brief-helper:</strong> we leveren een pre-gefilde
                  tekst die je in het OWR-formulier kunt plakken — geen
                  blank-paper-stress.
                </li>
                <li>
                  <strong>Deadline-bewaking:</strong> we herinneren je vóór de
                  OWR-deadline (1 mei 2026 zelf-indiener · 1 oktober 2026 via
                  adviseur).
                </li>
                <li>
                  <strong>OCR + auto-charge:</strong> zodra je beschikking
                  binnen is en je 'm uploadt, detecteren we automatisch het
                  toegekende bedrag en charge'n we onze fee — alleen op het
                  werkelijk uitbetaalde bedrag.
                </li>
                <li>
                  <strong>Géén dunning:</strong> faalt de Stripe-afschrijving,
                  dan nemen we handmatig contact op. Geen incassobureau, geen
                  rentes.
                </li>
              </ul>
              <p>
                <strong>Wat JIJ zelf doet:</strong> je dient het OWR-formulier
                in via MijnBelastingdienst (DigiD-login bij Belastingdienst
                zelf — wij zien je rekening niet en raken je vermogensdata
                nooit aan).
              </p>
              <p className="text-xs text-slate-600">
                <strong>Eerlijk over de prijs:</strong> belastingadviseurs
                rekenen € 150-500 per uur (€ 300-2.000 per box-3-zaak) en
                claimbureaus houden een fors percentage in. Wij vragen niets.
                Dat is geen aanbieding maar een keuze: dit is een project, geen
                bedrijf. Wat je terugkrijgt is helemaal van jou.
              </p>
            </div>
          </details>
          <button
            type="button"
            data-testid="box3-ncnp-cta"
            disabled={ncnpState.kind === "pending" || ncnpState.kind === "ok"}
            onClick={() => {
              track("box3_ncnp_chosen", { jaar: result.jaar });
              void startNcnpClaim();
            }}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40"
          >
            {ncnpState.kind === "pending"
              ? "Bezig…"
              : ncnpState.kind === "ok"
                ? "Verstuurd ✓"
                : "Start NCNP — wij doen het OWR voor je →"}
          </button>
          {ncnpState.kind === "ok" ? (
            <p data-testid="box3-ncnp-ok" className="mt-2 text-sm text-brand-800">
              {ncnpState.message}
            </p>
          ) : null}
          {ncnpState.kind === "auth" ? (
            <p data-testid="box3-ncnp-auth" className="mt-2 text-sm text-rose-700">
              Log eerst in om de claim aan te maken —{" "}
              <a href="/login" className="underline">
                inloggen
              </a>
              .
            </p>
          ) : null}
          {ncnpState.kind === "error" ? (
            <p data-testid="box3-ncnp-error" className="mt-2 text-sm text-rose-700">
              {ncnpState.message}
            </p>
          ) : null}
        </div>
      ) : (
        result.verwachteTeruggaveCents > 0 ? (
          <div
            data-testid="box3-diy-only-card"
            className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
          >
            <h3 className="text-lg font-semibold text-slate-900">
              Doe 't lekker zelf — gratis
            </h3>
            <p className="mt-1 text-sm text-slate-700">
              Onder € 500 verwachte teruggave is een no-cure-no-pay fee niet
              eerlijk — we leveren je de gratis DIY-brief en je dient zelf
              in via MijnBelastingdienst. Geen fee, geen lock-in.
            </p>
          </div>
        ) : null
      )}

      <div className="mt-6">
        <button
          type="button"
          data-testid="box3-diy-toggle"
          onClick={() => {
            setBriefOpen(!briefOpen);
            if (!briefOpen) track("box3_diy_chosen", { jaar: result.jaar });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {briefOpen ? "Verberg DIY-brief" : "Toon DIY-brief (gratis)"}
        </button>
        {briefOpen ? (
          <pre
            data-testid="box3-diy-brief"
            className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-800"
          >
            {box3DiyBrief(input, result)}
          </pre>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        {BOX3_DISCLAIMER}
      </p>
    </section>
  );
}
