"use client";

/**
 * /zorgkosten-check — gratis indicatie + checklist veelvergeten zorgkosten.
 *
 * Privacy: pure berekening client-side. Inkomen + zorgkosten verlaten browser niet.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseEurInput, formatEurCents } from "@/lib/format";
import {
  estimateZorgkostenAftrek,
  CHECKLIST_VEELVERGETEN,
  ZORGKOSTEN_DISCLAIMER,
  ZORGKOSTEN_PEILDATUM,
  type ZorgkostenInput,
  type ZorgkostenResult,
} from "@/lib/zorgkosten";
import { track } from "@/lib/analytics";
import PostCheckCta from "@/components/PostCheckCta";

const CATEGORIES = [
  { id: "geneeskundigeHulp", label: "Genees-/heelkundige hulp (arts, fysio buiten basis, tandarts boven basis)" },
  { id: "medicijnen", label: "Voorgeschreven medicijnen" },
  { id: "hulpmiddelen", label: "Hulpmiddelen (gehoorapparaat, prothese, steunzolen)" },
  { id: "vervoerZiekte", label: "Vervoer i.v.m. doktersbezoek/ziekenhuis" },
  { id: "ziekenbezoek", label: "Reiskosten ziekenbezoek (> 10 km / > 10 dgn)" },
  { id: "dieet", label: "Dieet op doktersrecept (forfait)" },
  { id: "extraGezinshulp", label: "Extra gezinshulp i.v.m. ziekte" },
  { id: "extraKleding", label: "Extra kleding en beddengoed (forfait)" },
  { id: "ivf", label: "IVF (boven 3e poging)" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export default function ZorgkostenCheckClient() {
  const [inkomen, setInkomen] = useState("");
  const [partner, setPartner] = useState(false);
  const [aow, setAow] = useState(false);
  const [waardes, setWaardes] = useState<Record<CategoryId, string>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, ""])) as Record<CategoryId, string>,
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ZorgkostenResult | null>(null);

  useEffect(() => {
    track("zorgkosten_check_started");
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const i = parseEurInput(inkomen);
    if (i == null) {
      setError("Vul je drempelinkomen in (≈ verzamelinkomen).");
      return;
    }
    const k: Partial<Record<CategoryId, number>> = {};
    for (const c of CATEGORIES) {
      const v = parseEurInput(waardes[c.id]);
      if (v != null && v > 0) k[c.id] = v;
    }
    const input: ZorgkostenInput = {
      drempelinkomenCents: i,
      partner,
      aowGerechtigd: aow,
      kostenPerCategorie: k as ZorgkostenInput["kostenPerCategorie"],
    };
    const r = estimateZorgkostenAftrek(input);
    setResult(r);
    track("zorgkosten_results_viewed", {
      partner,
      aow,
      heeftAftrek: r.indicatieJa,
      aantalCategorieenIngevuld: Object.keys(k).length,
    });
    setTimeout(() => {
      document.getElementById("zorgkosten-results")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  function setVal(id: CategoryId, v: string) {
    setWaardes((w) => ({ ...w, [id]: v }));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Aangifte-helper — Specifieke zorgkosten
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Welke zorgkosten kun je aftrekken?
        </h1>
        <p className="mt-3 text-slate-600">
          Drempel-formule 2026: max(€ 166, 1,65% × drempelinkomen). Alleen kosten
          boven de drempel zijn aftrekbaar. We tonen indicatie + uitgebreide
          checklist; je rekent in je eigen browser.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong className="font-semibold text-slate-900">Privacy:</strong> deze
        check rekent client-side. Inkomen + zorgkosten worden niet verstuurd of
        opgeslagen.
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 ph-no-capture">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Drempelinkomen</span>
            <input
              type="text"
              inputMode="decimal"
              value={inkomen}
              onChange={(e) => setInkomen(e.target.value)}
              placeholder="bv. 35.000"
              data-testid="zorg-inkomen"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              ≈ verzamelinkomen voor de aftrekposten — staat op je vorige aangifte.
            </span>
          </label>

          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={partner}
                onChange={(e) => setPartner(e.target.checked)}
                data-testid="zorg-partner"
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>Met fiscaal partner (gezamenlijke drempel)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={aow}
                onChange={(e) => setAow(e.target.checked)}
                data-testid="zorg-aow"
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>AOW-gerechtigd op 1 januari (113%-verhoging in scope)</span>
            </label>
          </div>
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            Zorgkosten per categorie (vul in wat van toepassing is)
          </legend>
          <div className="mt-2 grid gap-3">
            {CATEGORIES.map((c) => (
              <label key={c.id} className="block text-sm">
                <span className="text-slate-800">{c.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={waardes[c.id]}
                  onChange={(e) => setVal(c.id, e.target.value)}
                  placeholder="€ 0"
                  data-testid={`zorg-${c.id}`}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
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
          data-testid="zorg-submit"
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
        >
          Bereken indicatie
        </button>
      </form>

      {result ? <Results result={result} /> : null}

      <Checklist />

      {result ? (
        <PostCheckCta
          fromCheck="zorgkosten"
          vondstCents={result.indicatieJa && result.aftrekbaarCents > 0 ? result.aftrekbaarCents : null}
          vondstLabel="aftrekbaar"
        />
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        Peildatum {ZORGKOSTEN_PEILDATUM} · drempel + categorieën{" "}
        <Link href="/voorwaarden" className="underline">gesourcet</Link>{" "}
        uit Belastingdienst. Indicatie ≠ advies.
      </footer>
    </main>
  );
}

function Results({ result }: { result: ZorgkostenResult }) {
  return (
    <section
      id="zorgkosten-results"
      data-testid="zorg-results"
      className={`mt-10 scroll-mt-12 rounded-2xl border p-6 ${
        result.indicatieJa ? "border-brand-200 bg-brand-50/40" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
        Indicatie
      </p>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {result.indicatieJa
          ? `Tot ${formatEurCents(result.aftrekbaarCents)} aftrekbaar`
          : "Onder de drempel — niets aftrekbaar"}
      </p>
      <p className="mt-2 text-sm text-slate-700">{result.uitleg}</p>
      <p className="mt-2 text-xs text-slate-500">
        Drempel {formatEurCents(result.drempelCents)} ·{" "}
        Totaal opgegeven {formatEurCents(result.totaalKostenCents)}.
      </p>
      <p className="mt-4 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        {ZORGKOSTEN_DISCLAIMER}
      </p>
    </section>
  );
}

function Checklist() {
  return (
    <section
      data-testid="zorg-checklist"
      className="mt-10 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-xl font-bold text-slate-900">
        Checklist veelvergeten posten
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Voor elke post: kort de regel + of het mogelijk aftrekbaar is. Eindcontrole
        bij je aangifte zelf — bewaar facturen/recepten.
      </p>
      <ul className="mt-4 divide-y divide-slate-200">
        {CHECKLIST_VEELVERGETEN.map((c) => (
          <li
            key={c.id}
            data-testid={`zorg-checklist-${c.id}`}
            className="flex items-start gap-3 py-3"
          >
            <span
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                c.mogelijkAftrekbaar ? "bg-brand-100 text-brand-800" : "bg-slate-200 text-slate-600"
              }`}
            >
              {c.mogelijkAftrekbaar ? "✓" : "✗"}
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">{c.label}</div>
              <div className="text-xs text-slate-600">{c.toelichting}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
