"use client";

/**
 * /geld-check — gratis check op gemiste toeslagen + gemeente-regelingen.
 *
 * Privacy-by-design: alle berekening draait CLIENT-SIDE in `estimateBenefits`.
 * Inkomen, vermogen, kinderen en huur worden NIET naar de server gestuurd of
 * opgeslagen. PostHog krijgt alleen booleans/counts (geen PII).
 *
 * Inhoud (grenzen/bedragen) komt EXACT uit lib/toeslagen.ts → bron-van-waarheid
 * docs/BENEFITS_DATA_2026.md (peildatum 2026, sourced).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseEurInput, formatEurCents } from "@/lib/format";
import {
  estimateBenefits,
  GELD_CHECK_DISCLAIMER,
  TOESLAGEN_PEILDATUM,
  type BenefitEstimate,
  type BenefitStatus,
  type GeldCheckInput,
  type GeldCheckResult,
  type Huishouden,
} from "@/lib/toeslagen";
import { track } from "@/lib/analytics";
import PostCheckCta from "@/components/PostCheckCta";

const STATUS_STYLES: Record<BenefitStatus, { pill: string; label: string; card: string }> = {
  likely: {
    pill: "bg-brand-100 text-brand-800",
    label: "Waarschijnlijk recht",
    card: "border-brand-200 bg-brand-50/40",
  },
  maybe: {
    pill: "bg-amber-100 text-amber-900",
    label: "Mogelijk recht",
    card: "border-amber-200 bg-amber-50/40",
  },
  unlikely: {
    pill: "bg-slate-100 text-slate-600",
    label: "Waarschijnlijk geen recht",
    card: "border-slate-200 bg-white",
  },
};

export default function GeldCheckClient() {
  const [huishouden, setHuishouden] = useState<Huishouden>("alleenstaand");
  const [leeftijd, setLeeftijd] = useState("");
  const [inkomen, setInkomen] = useState("");
  const [vermogen, setVermogen] = useState("");
  const [huurt, setHuurt] = useState(false);
  const [huur, setHuur] = useState("");
  const [kinderen, setKinderen] = useState<string[]>([]);
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<GeldCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Funnel-event — geen PII.
    track("geld_check_started");
  }, []);

  function addChild() {
    setKinderen((arr) => [...arr, ""]);
  }
  function setChildAge(i: number, v: string) {
    setKinderen((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  }
  function removeChild(i: number) {
    setKinderen((arr) => arr.filter((_, idx) => idx !== i));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const leef = Number(leeftijd);
    if (!Number.isFinite(leef) || leef <= 0 || leef > 120) {
      setError("Vul een geldige leeftijd in (in jaren).");
      return;
    }
    const ink = parseEurInput(inkomen);
    if (ink == null) {
      setError("Vul je bruto jaar(toetsings)inkomen in — bv. 25.000 of € 32.500.");
      return;
    }
    const verm = parseEurInput(vermogen) ?? 0;
    const huurCents = huurt ? parseEurInput(huur) : null;
    if (huurt && (huurCents == null || huurCents <= 0)) {
      setError("Vul je kale huur per maand in, of geef aan dat je geen huurder bent.");
      return;
    }
    const kids = kinderen
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 30)
      .map((n) => ({ leeftijd: n }));

    const input: GeldCheckInput = {
      huishouden,
      leeftijd: leef,
      brutoJaarinkomenCents: ink,
      vermogenCents: verm,
      kaleHuurPerMaandCents: huurCents,
      kinderen: kids,
      postcode: postcode.trim() || null,
    };
    const r = estimateBenefits(input);
    setResult(r);
    // Funnel-event — alleen non-PII booleans/counts.
    track("geld_check_results_viewed", {
      huishouden,
      heeftKinderen: kids.length > 0,
      aantalKinderen: kids.length,
      huurt,
      aantalLikely: r.estimates.filter((x) => x.status === "likely").length,
      aantalMaybe: r.estimates.filter((x) => x.status === "maybe").length,
    });
    // Scroll naar resultaten
    setTimeout(() => {
      document.getElementById("geld-check-results")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Gratis check — geen DigiD
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Vind al je geld: welke toeslagen loop je mis?
        </h1>
        <p className="mt-3 text-slate-600">
          Indicatie op de officiële 2026-grenzen (zorgtoeslag, huurtoeslag, kindgebonden
          budget) plus een verwijzing naar de gemeente-regelingen. Je gegevens blijven
          in je browser — we slaan niets op.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong className="font-semibold text-slate-900">Privacy:</strong> deze check
        rekent in je eigen browser. Je inkomen, vermogen en huur worden niet
        verstuurd of opgeslagen. Het resultaat is een <em>indicatie</em>; de
        Belastingdienst bepaalt het exacte bedrag.
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 ph-no-capture">
        {/* Huishouden */}
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Je situatie</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <label
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
                huishouden === "alleenstaand"
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="huishouden"
                value="alleenstaand"
                checked={huishouden === "alleenstaand"}
                onChange={() => setHuishouden("alleenstaand")}
                className="sr-only"
              />
              Alleenstaand
            </label>
            <label
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
                huishouden === "met_partner"
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="huishouden"
                value="met_partner"
                checked={huishouden === "met_partner"}
                onChange={() => setHuishouden("met_partner")}
                className="sr-only"
              />
              Met toeslagpartner
            </label>
          </div>
        </fieldset>

        {/* Leeftijd + inkomen + vermogen */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Leeftijd</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={leeftijd}
              onChange={(e) => setLeeftijd(e.target.value)}
              placeholder="bv. 32"
              data-testid="geld-leeftijd"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-slate-900">
              Bruto jaarinkomen{huishouden === "met_partner" ? " (samen)" : ""}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={inkomen}
              onChange={(e) => setInkomen(e.target.value)}
              placeholder="bv. 25.000"
              data-testid="geld-inkomen"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Schatting van je toetsingsinkomen — bruto loon + andere inkomsten per jaar.
            </span>
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Vermogen op 1 januari</span>
            <input
              type="text"
              inputMode="decimal"
              value={vermogen}
              onChange={(e) => setVermogen(e.target.value)}
              placeholder="bv. 5.000"
              data-testid="geld-vermogen"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Spaargeld + beleggingen samen. Laat leeg/0 als je niets boven het normale spaargeld hebt.
            </span>
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-slate-900">Postcode (optioneel)</span>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="bv. 1234 AB"
              data-testid="geld-postcode"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              maxLength={7}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Alleen voor de verwijzing naar je gemeente.
            </span>
          </label>
        </div>

        {/* Huur */}
        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Woon je in een huurwoning?</legend>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={huurt}
              onChange={(e) => setHuurt(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ja, ik huur (anders → koopwoning)
          </label>
          {huurt ? (
            <label className="mt-3 block text-sm">
              <span className="font-semibold text-slate-900">Kale huur per maand</span>
              <input
                type="text"
                inputMode="decimal"
                value={huur}
                onChange={(e) => setHuur(e.target.value)}
                placeholder="bv. 650"
                data-testid="geld-huur"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-1/2"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Kale huur (zonder service-/stookkosten). Nieuw in 2026: ook bij een
                hogere huur kun je nog huurtoeslag krijgen.
              </span>
            </label>
          ) : null}
        </fieldset>

        {/* Kinderen */}
        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Inwonende kinderen onder 18</legend>
          {kinderen.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">Voeg een kind toe als dat van toepassing is.</p>
          ) : null}
          <div className="mt-2 space-y-2">
            {kinderen.map((age, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={30}
                  value={age}
                  onChange={(e) => setChildAge(i, e.target.value)}
                  data-testid={`geld-kind-${i}`}
                  placeholder="leeftijd"
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeChild(i)}
                  className="text-sm text-slate-500 underline hover:text-slate-700"
                >
                  verwijder
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addChild}
            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Kind toevoegen
          </button>
        </fieldset>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
          data-testid="geld-check-submit"
        >
          Bereken — vind mijn geld
        </button>
      </form>

      {result ? <Results result={result} /> : null}
      {result ? (
        <PostCheckCta
          fromCheck="geld"
          vondstCents={result.totaalIndicatieMaandCents > 0 ? result.totaalIndicatieMaandCents : null}
          vondstLabel="toeslag mogelijk/mnd"
        />
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Peildatum {TOESLAGEN_PEILDATUM} · alle grenzen/bedragen{" "}
          <Link href="/voorwaarden" className="underline">
            gesourcet
          </Link>{" "}
          uit officiële bronnen (Belastingdienst / Rijksoverheid / Consumentenbond /
          Nibud). Dit is een indicatie, geen advies.
        </p>
      </footer>
    </main>
  );
}

function Results({ result }: { result: GeldCheckResult }) {
  return (
    <section id="geld-check-results" className="mt-10 scroll-mt-12">
      {result.totaalIndicatieMaandCents > 0 ? (
        <div className="rounded-2xl bg-brand-600 p-6 text-white shadow-md">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-50">
            Indicatie
          </p>
          <p className="mt-1 text-3xl font-bold sm:text-4xl">
            Je loopt tot {formatEurCents(result.totaalIndicatieMaandCents)}/mnd mis
          </p>
          <p className="mt-2 text-sm text-brand-50">
            Bovengrens-schatting van zorgtoeslag + kindgebonden budget. Plus mogelijk
            huurtoeslag en gemeente-regelingen (zie hieronder).
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-100 p-6 text-slate-800">
          <p className="text-lg font-semibold">Geen evident gemist toeslag-bedrag gevonden</p>
          <p className="mt-2 text-sm text-slate-600">
            Check toch de items hieronder — gemeente-regelingen en huurtoeslag kunnen
            alsnog spelen.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {result.estimates.map((e) => (
          <BenefitCard key={e.id} estimate={e} />
        ))}
      </ul>

      {/* v28 funnel — door-stroom naar de rekeningen-onderhandeling. */}
      <CrossCTA result={result} />

      <p className="mt-8 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        {result.disclaimer}
      </p>
    </section>
  );
}

function CrossCTA({ result }: { result: GeldCheckResult }) {
  const found = result.totaalIndicatieMaandCents > 0;
  return (
    <section
      data-testid="geld-check-cross-cta"
      className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/40 p-6"
    >
      <h3 className="text-lg font-semibold text-slate-900">
        {found
          ? "Mooi — laten we ook je vaste lasten checken"
          : "Geen evident toeslagenrecht — check je vaste lasten"}
      </h3>
      <p className="mt-1 text-sm text-slate-700">
        {found ? (
          <>
            Bovenop de tot{" "}
            <strong>{formatEurCents(result.totaalIndicatieMaandCents)}/mnd</strong>{" "}
            aan toeslagen kun je vaak nog €350–€800 per jaar besparen door je
            telefoon-, internet- of energierekening te laten onderhandelen.
          </>
        ) : (
          <>
            Een gemiddeld huishouden bespaart €350–€800 per jaar op vaste lasten
            zoals telefoon, internet en energie. Upload je rekening — we
            onderhandelen automatisch en je betaalt alleen 20% van wat we
            besparen.
          </>
        )}
      </p>
      <Link
        href="/onderhandel"
        onClick={() => track("geld_check_to_onderhandel", { found })}
        className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        Check ook mijn rekeningen →
      </Link>
    </section>
  );
}

function BenefitCard({ estimate }: { estimate: BenefitEstimate }) {
  const s = STATUS_STYLES[estimate.status];
  const indicatie =
    estimate.indicatieMaandCents != null
      ? `${formatEurCents(estimate.indicatieMaandCents)}/mnd`
      : estimate.indicatieJaarCents != null
        ? `${formatEurCents(estimate.indicatieJaarCents)}/jr`
        : null;

  return (
    <li className={`rounded-xl border p-5 ${s.card}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{estimate.naam}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill}`}>
          {s.label}
        </span>
      </div>
      <p className="mt-1 text-base font-medium text-slate-900">
        {estimate.kop}
        {indicatie && !estimate.kop.includes("€") ? (
          <span className="ml-2 text-slate-500">({indicatie})</span>
        ) : null}
      </p>
      <p className="mt-2 text-sm text-slate-700">{estimate.uitleg}</p>
      {estimate.status !== "unlikely" ? (
        <div className="mt-4">
          <a
            href={estimate.aanvraagUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("geld_check_aanvraag_clicked", { benefit: estimate.id })
            }
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Aanvragen / proefberekening →
          </a>
        </div>
      ) : null}
    </li>
  );
}
