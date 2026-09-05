"use client";

/**
 * /energie-claim-check — V35 DEEL 2 — gratis Energie-eindafrekening-check.
 *
 * Privacy-by-design: alle berekening draait CLIENT-SIDE in
 * `estimateEnergieEindafrekeningRestitutie`. Provider, bedragen, meterstanden
 * en heffingen-vlaggen verlaten de browser NIET. PostHog krijgt alleen
 * booleans/counts (geen PII).
 *
 * Revenue-gate (guardrail V35): v41: gratis, dus geen drempel meer.
 * ≥ € 50 — anders DIY-klachtbrief gratis.
 *
 * Energiebelasting-vermindering 2026: we hardcoderen GEEN bedrag (verandert
 * jaarlijks). We controleren alleen of de regel "Vermindering energiebelasting"
 * überhaupt op de afrekening staat (heffingskortingenAanwezig).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseEurInput, formatEurCents } from "@/lib/format";
import {
  estimateEnergieEindafrekeningRestitutie,
  energieKlachtBrief,
  ENERGIE_DISCLAIMER,
  ENERGIE_PEILDATUM,
  ENERGIE_NCNP_DREMPEL_CENTS,
  ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS,
  ENERGIE_KLACHTGELD_VERGOEDING_CENTS,
  ENERGIE_LEVERANCIER_REACTIE_DAGEN,
  type EnergieEindafrekeningInput,
  type EnergieEindafrekeningResult,
} from "@/lib/energie-claim";
import { track } from "@/lib/analytics";
import PostCheckCta from "@/components/PostCheckCta";

const STATUS_STYLES: Record<EnergieEindafrekeningResult["status"], { pill: string; label: string; card: string }> = {
  likely: {
    pill: "bg-brand-100 text-brand-800",
    label: "Klacht loont waarschijnlijk",
    card: "border-brand-200 bg-brand-50/40",
  },
  maybe: {
    pill: "bg-amber-100 text-amber-900",
    label: "Mogelijk grond — controleer rode vlaggen",
    card: "border-amber-200 bg-amber-50/40",
  },
  unlikely: {
    pill: "bg-slate-100 text-slate-600",
    label: "Geen evidente klacht-grond",
    card: "border-slate-200 bg-white",
  },
};

export default function EnergieClaimCheckClient() {
  const [provider, setProvider] = useState("");
  const [dagenAfrekening, setDagenAfrekening] = useState("");
  const [bedrag, setBedrag] = useState("");
  const [tariefAfwijking, setTariefAfwijking] = useState("");
  const [heffingsAanwezig, setHeffingsAanwezig] = useState(true);
  const [meterstandConsistent, setMeterstandConsistent] = useState(true);
  const [dubbeleHeffing, setDubbeleHeffing] = useState(false);
  const [salderingCorrect, setSalderingCorrect] = useState<"ja" | "nee" | "nvt">("nvt");
  const [result, setResult] = useState<EnergieEindafrekeningResult | null>(null);
  const [input, setInput] = useState<EnergieEindafrekeningInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  useEffect(() => {
    track("energie_claim_check_started");
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (provider.trim().length === 0) {
      setError("Vul de naam van je energieleverancier in (bv. Vattenfall).");
      return;
    }
    const dagen = Number(dagenAfrekening);
    if (!Number.isFinite(dagen) || dagen < 0) {
      setError("Vul het aantal dagen tussen contract-einde en eindafrekening in (bv. 28).");
      return;
    }
    const b = parseEurInput(bedrag);
    if (b == null) {
      setError("Vul het eindafrekening-totaalbedrag in (bv. 245,67 — positief = bij te betalen).");
      return;
    }
    const tarief = tariefAfwijking.trim() === "" ? null : parseEurInput(tariefAfwijking) ?? null;
    const inp: EnergieEindafrekeningInput = {
      provider: provider.trim(),
      dagenTussenContracteindeEnAfrekening: Math.round(dagen),
      eindafrekeningBedragCents: b,
      tariefAfwijkingCents: tarief,
      heffingskortingenAanwezig: heffingsAanwezig,
      meterstandConsistent,
      dubbeleHeffingenAanwezig: dubbeleHeffing,
      salderingCorrect: salderingCorrect === "nvt" ? null : salderingCorrect === "ja",
    };
    const r = estimateEnergieEindafrekeningRestitutie(inp);
    setInput(inp);
    setResult(r);
    track("energie_claim_results_viewed", {
      status: r.status,
      rodeVlaggenAantal: r.rodeVlaggenAantal,
      biedNcnpAan: r.biedNcnpAan,
      verwachteRange: r.verwachteRestitutieCents >= ENERGIE_NCNP_DREMPEL_CENTS ? "ge_50" : "lt_50",
    });
    setTimeout(() => {
      document.getElementById("energie-results")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Geschillencommissie Energie — eindafrekening
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Klopt jouw energie-eindafrekening?
        </h1>
        <p className="mt-3 text-slate-600">
          Energieleveranciers moeten {/* bron: art. 31 EW/GW */} binnen 6 weken na
          contract-einde de eindafrekening sturen, met heffingskorting,
          consistente meterstand en correct tarief. Gratis indicatie op rode
          vlaggen. Je gegevens blijven in je browser — we slaan niets op.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong className="font-semibold text-slate-900">Privacy:</strong> deze
        check rekent in je eigen browser. Provider-naam, bedragen en je
        rode-vlaggen-antwoorden worden niet verstuurd of opgeslagen. Indicatie ≠
        advies — Geschillencommissie Energie bepaalt het exacte bedrag.
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
        <strong>Energiebelasting-vermindering 2026:</strong> € 628,96 incl. btw
        per jaar (was € 635,19 in 2025) — geverifieerd in het Belastingplan
        2026. Op je eindafrekening hoort <em>altijd</em> een regel "Vermindering
        energiebelasting € X" te staan zolang je een leveringscontract had,
        naar rato van de contractperiode. Ontbreekt die regel of staat er
        € 0 bij een vol contract-jaar → directe rode vlag.
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 ph-no-capture">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Energieleverancier</span>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="bv. Vattenfall, Eneco, Greenchoice"
              data-testid="energie-provider"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">
              Dagen tussen contract-einde en eindafrekening
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={dagenAfrekening}
              onChange={(e) => setDagenAfrekening(e.target.value)}
              placeholder="bv. 28"
              data-testid="energie-dagen"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Wettelijk max. 42 dagen (6 weken). Erboven → rode vlag.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Eindafrekening totaalbedrag</span>
            <input
              type="text"
              inputMode="decimal"
              value={bedrag}
              onChange={(e) => setBedrag(e.target.value)}
              placeholder="bv. 245,67"
              data-testid="energie-bedrag"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Positief = bij te betalen, ook ok. Bovengrens-indicatie schaalt met dit bedrag.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">
              Tarief boven contract-tarief? (per kWh, optioneel)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={tariefAfwijking}
              onChange={(e) => setTariefAfwijking(e.target.value)}
              placeholder="bv. 0,05 (verschil per kWh)"
              data-testid="energie-tarief-afwijking"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Laat leeg als je niet zeker weet of je werkelijke tarief afwijkt.
            </span>
          </label>
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Rode vlaggen</legend>
          <div className="mt-2 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={!heffingsAanwezig}
                onChange={(e) => setHeffingsAanwezig(!e.target.checked)}
                data-testid="energie-vlag-geen-heffing"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Op mijn afrekening staat <strong>géén</strong> "Vermindering
                energiebelasting"-regel (of staat op € 0 bij vol contract-jaar)
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={!meterstandConsistent}
                onChange={(e) => setMeterstandConsistent(!e.target.checked)}
                data-testid="energie-vlag-meterstand"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                De meterstand op de afrekening klopt <strong>niet</strong> met
                mijn laatste opname/foto
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={dubbeleHeffing}
                onChange={(e) => setDubbeleHeffing(e.target.checked)}
                data-testid="energie-vlag-dubbel"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Er staan <strong>dubbele</strong> heffingen op (bv. vastrecht
                + leveringskosten 2× of CO₂-heffing 2×)
              </span>
            </label>
            <div className="text-sm">
              <span className="font-semibold text-slate-900">Zonnepanelen / saldering?</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {(["nvt", "ja", "nee"] as const).map((opt) => (
                  <label
                    key={opt}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs ${
                      salderingCorrect === opt
                        ? "border-brand-600 bg-brand-50 text-brand-800"
                        : "border-slate-300 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saldering"
                      value={opt}
                      checked={salderingCorrect === opt}
                      onChange={() => setSalderingCorrect(opt)}
                      data-testid={`energie-saldering-${opt}`}
                      className="sr-only"
                    />
                    {opt === "nvt" ? "Geen zonnepanelen" : opt === "ja" ? "Saldering correct" : "Saldering niet correct"}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          data-testid="energie-submit"
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
          fromCheck="energie-claim"
          vondstCents={result.verwachteRestitutieCents > 0 ? result.verwachteRestitutieCents : null}
          vondstLabel="verwachte restitutie"
        />
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Peildatum {ENERGIE_PEILDATUM} · procedures + leges{" "}
          <Link href="/voorwaarden" className="underline">
            gesourcet
          </Link>{" "}
          uit Geschillencommissie Energie + ACM + Elektriciteitswet/Gaswet 2026.
          Indicatie ≠ advies. Reactietijd leverancier: {ENERGIE_LEVERANCIER_REACTIE_DAGEN} dagen.
          Leges € {(ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS / 100).toLocaleString("nl-NL")}{" "}
          + klachtgeld € {(ENERGIE_KLACHTGELD_VERGOEDING_CENTS / 100).toLocaleString("nl-NL")}{" "}
          retour bij winst.
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
  result: EnergieEindafrekeningResult;
  input: EnergieEindafrekeningInput;
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
      const r = await fetch("/api/energie-claim/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: result.provider,
          verwachteRestitutieCents: result.verwachteRestitutieCents,
        }),
      });
      if (r.status === 401) {
        setNcnpState({ kind: "auth" });
        return;
      }
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
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
          "voor zodra de Geschillencommissie-uitspraak binnen is.",
      });
    } catch {
      setNcnpState({ kind: "error", message: "Netwerkfout — probeer het opnieuw." });
    }
  }

  return (
    <section id="energie-results" className={`mt-10 scroll-mt-12 rounded-2xl border p-6 ${s.card}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Indicatie {result.provider}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill}`}>
          {s.label}
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {verwacht
          ? `Bovengrens-indicatie restitutie: ${verwacht}`
          : "Geen evidente klacht-grond"}
      </p>
      <p className="mt-2 text-sm text-slate-700">{result.uitleg}</p>

      {result.actieveRodeVlaggen.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-0.5">
          {result.actieveRodeVlaggen.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs text-slate-700">
        <p>
          <strong>Termijnen:</strong>
        </p>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          <li>
            Eindafrekening uiterlijk{" "}
            <strong>{result.klachtTermijnen.eindafrekeningDeadlineDagen} dagen</strong>{" "}
            na contract-einde (art. 31 EW/GW).
          </li>
          <li>
            Leverancier reactietijd op klacht:{" "}
            <strong>{result.klachtTermijnen.leverancierReactieDagen} dagen</strong>{" "}
            (Wet handhaving consumentenbescherming).
          </li>
          <li>
            Geschillencommissie Energie behandelt gemiddeld in{" "}
            <strong>{result.klachtTermijnen.geschillencommissieBehandelingMaanden} maanden</strong>;
            leges € {(ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS / 100).toLocaleString("nl-NL")} +
            klachtgeld € {(ENERGIE_KLACHTGELD_VERGOEDING_CENTS / 100).toLocaleString("nl-NL")}
            {" "}retour bij winst.
          </li>
        </ul>
      </div>

      {result.biedNcnpAan ? (
        <div
          data-testid="energie-ncnp-card"
          className="mt-6 rounded-xl border border-brand-300 bg-white p-5"
        >
          <h3 className="text-lg font-semibold text-slate-900">
            Wij doen de klacht voor je — gratis
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            We stellen het klachttraject (leverancier → Geschillencommissie)
            voor je op, <strong>gratis</strong>. Let op: de
            Geschillencommissie zelf vraagt € 27,50 leges plus € 52,50
            klachtgeld — dat gaat naar hen en krijg je terug als je wint.
            Liever zelf doen? Hieronder staat dezelfde brief.
          </p>
          <button
            type="button"
            data-testid="energie-ncnp-cta"
            disabled={ncnpState.kind === "pending" || ncnpState.kind === "ok"}
            onClick={() => {
              track("energie_claim_ncnp_chosen", { provider: result.provider });
              void startNcnpClaim();
            }}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40"
          >
            {ncnpState.kind === "pending"
              ? "Bezig…"
              : ncnpState.kind === "ok"
                ? "Verstuurd ✓"
                : "Start — wij regelen de klacht →"}
          </button>
          {ncnpState.kind === "ok" ? (
            <p data-testid="energie-ncnp-ok" className="mt-2 text-sm text-brand-800">
              {ncnpState.message}
            </p>
          ) : null}
          {ncnpState.kind === "auth" ? (
            <p data-testid="energie-ncnp-auth" className="mt-2 text-sm text-rose-700">
              Log eerst in om de claim aan te maken —{" "}
              <a href="/login" className="underline">
                inloggen
              </a>
              .
            </p>
          ) : null}
          {ncnpState.kind === "error" ? (
            <p data-testid="energie-ncnp-error" className="mt-2 text-sm text-rose-700">
              {ncnpState.message}
            </p>
          ) : null}
        </div>
      ) : (
        result.verwachteRestitutieCents > 0 ? (
          <div
            data-testid="energie-diy-only-card"
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
          data-testid="energie-diy-toggle"
          onClick={() => {
            setBriefOpen(!briefOpen);
            if (!briefOpen) track("energie_claim_diy_chosen", { provider: result.provider });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {briefOpen ? "Verberg DIY-klachtbrief" : "Toon DIY-klachtbrief (gratis)"}
        </button>
        {briefOpen ? (
          <pre
            data-testid="energie-diy-brief"
            className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-800"
          >
            {energieKlachtBrief(input, result)}
          </pre>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        {ENERGIE_DISCLAIMER}
      </p>
    </section>
  );
}
