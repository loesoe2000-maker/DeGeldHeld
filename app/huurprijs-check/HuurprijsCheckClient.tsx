"use client";

/**
 * /huurprijs-check — v40 F3 — gratis WWS-puntentoets + huurverlaging-route.
 *
 * Privacy-by-design: de hele berekening draait CLIENT-SIDE
 * (checkHuurprijs). Adres, WOZ-waarde, huurprijs en kamermaten verlaten de
 * browser NIET. PostHog krijgt alleen het verdict + puntenaantal.
 *
 * Eerlijkheid-by-design:
 *  - de MARGE-REGEL: "kansrijk" alleen als de huur óók boven de ruim
 *    doorgerekende maximale huur ligt (zie lib/huurprijs-check.ts);
 *  - de ROUTE-vraag komt vóór het bedrag: veel huurders mogen helemaal geen
 *    procedure starten, en dat zeggen we dan gewoon;
 *  - de Huurcommissie telt bij een zaak zelf opnieuw — dat staat er ook bij.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEurCents, parseEurInput } from "@/lib/format";
import { track } from "@/lib/analytics";
import PostCheckCta from "@/components/PostCheckCta";
import {
  checkHuurprijs,
  huurverlagingsBrief,
  vroegsteIngangsdatum,
  huurcommissieDeadline,
  HUURPRIJS_DISCLAIMER,
  HUURPRIJS_PEILDATUM,
  STANDAARD_MARGE,
  type ContractType,
  type HuurprijsResultaat,
} from "@/lib/huurprijs-check";
import type { EnergieLabel, Woonvorm, WwsInput } from "@/lib/wws-punten";

type RuimteSoort = "vertrek" | "overig";

interface RuimteRij {
  id: number;
  naam: string;
  soort: RuimteSoort;
  m2: string;
  verwarmd: boolean;
}

const START_RUIMTES: RuimteRij[] = [
  { id: 1, naam: "Woonkamer", soort: "vertrek", m2: "", verwarmd: true },
  { id: 2, naam: "Keuken", soort: "vertrek", m2: "", verwarmd: true },
  { id: 3, naam: "Slaapkamer", soort: "vertrek", m2: "", verwarmd: true },
  { id: 4, naam: "Badkamer", soort: "vertrek", m2: "", verwarmd: true },
];

const LABELS: EnergieLabel[] = ["A++++", "A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G"];

const VERDICT_STYLE: Record<
  HuurprijsResultaat["verdict"],
  { pill: string; kop: string; card: string }
> = {
  onzelfstandig: {
    pill: "bg-sky-100 text-sky-900",
    kop: "Ander puntenstelsel — wij rekenen dit (nog) niet uit",
    card: "border-sky-200 bg-sky-50/50",
  },
  kansrijk: {
    pill: "bg-brand-100 text-brand-800",
    kop: "Je betaalt waarschijnlijk te veel huur",
    card: "border-brand-200 bg-brand-50/40",
  },
  twijfelgeval: {
    pill: "bg-amber-100 text-amber-900",
    kop: "Twijfelgeval — nog niet indienen",
    card: "border-amber-200 bg-amber-50/40",
  },
  geen_zaak: {
    pill: "bg-slate-100 text-slate-600",
    kop: "Je huur past bij het puntenaantal",
    card: "border-slate-200 bg-white",
  },
  geen_route: {
    pill: "bg-slate-100 text-slate-600",
    kop: "Geen procedure mogelijk voor jouw contract",
    card: "border-slate-200 bg-white",
  },
  buiten_tabel: {
    pill: "bg-slate-100 text-slate-600",
    kop: "Buiten de officiële tabel",
    card: "border-slate-200 bg-white",
  },
};

export default function HuurprijsCheckClient({ isAdmin = false }: { isAdmin?: boolean }) {
  // Woning
  const [woonvorm, setWoonvorm] = useState<Woonvorm>("meergezins");
  const [aantalBewoners, setAantalBewoners] = useState("1");
  const [gemeenschappelijk, setGemeenschappelijk] = useState(false);
  const [wozEuro, setWozEuro] = useState("");
  const [label, setLabel] = useState<EnergieLabel | "">("");
  const [bouwjaar, setBouwjaar] = useState("");
  const [ruimtes, setRuimtes] = useState<RuimteRij[]>(START_RUIMTES);
  // Keuken + sanitair
  const [aanrechtCm, setAanrechtCm] = useState("");
  const [toiletApart, setToiletApart] = useState(false);
  const [wastafels, setWastafels] = useState("1");
  const [douche, setDouche] = useState(true);
  const [bad, setBad] = useState(false);
  const [extrasIngevuld, setExtrasIngevuld] = useState(false);
  // Buitenruimte
  const [geenBuiten, setGeenBuiten] = useState(false);
  const [buitenM2, setBuitenM2] = useState("");
  // Contract + huur
  const [startDatum, setStartDatum] = useState("");
  const [contractType, setContractType] = useState<ContractType>("vast");
  const [eindDatum, setEindDatum] = useState("");
  const [kaleHuur, setKaleHuur] = useState("");
  const [huurtoeslag, setHuurtoeslag] = useState(false);

  const [resultaat, setResultaat] = useState<HuurprijsResultaat | null>(null);
  const [laatsteInput, setLaatsteInput] = useState<string>("");
  const [pilotLabel, setPilotLabel] = useState("");
  const [pilotStatus, setPilotStatus] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const num = (s: string): number => {
    const n = Number(String(s).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const totaalM2 = useMemo(
    () => ruimtes.reduce((s, r) => s + num(r.m2), 0),
    [ruimtes],
  );

  function voegRuimteToe(soort: RuimteSoort) {
    setRuimtes((rs) => [
      ...rs,
      {
        id: Math.max(0, ...rs.map((r) => r.id)) + 1,
        naam: soort === "vertrek" ? "Extra kamer" : "Berging",
        soort,
        m2: "",
        verwarmd: soort === "vertrek",
      },
    ]);
  }

  function bereken(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);

    const huurCents = parseEurInput(kaleHuur);
    const woz = num(wozEuro);
    if (!huurCents || huurCents <= 0) return setFout("Vul je kale maandhuur in.");
    if (woz <= 0) return setFout("Vul de WOZ-waarde in (gratis op te zoeken, link hierboven).");
    if (!startDatum) return setFout("Vul de ingangsdatum van je huurcontract in.");
    if (!label && !bouwjaar) {
      return setFout("Vul je energielabel in, of anders het bouwjaar van de woning.");
    }
    const gevuld = ruimtes.filter((r) => num(r.m2) > 0);
    if (gevuld.length === 0) return setFout("Vul minstens één ruimte met oppervlakte in.");

    const woning: WwsInput = {
      woonvorm,
      vertrekken: gevuld
        .filter((r) => r.soort === "vertrek")
        .map((r) => ({ m2: num(r.m2), verwarmd: r.verwarmd })),
      overigeRuimten: gevuld
        .filter((r) => r.soort === "overig")
        .map((r) => ({ m2: num(r.m2), verwarmd: r.verwarmd })),
      aanrechtLengteCm: num(aanrechtCm),
      sanitair: {
        toilettenAparteRuimte: toiletApart ? 1 : 0,
        wastafels: Math.max(0, Math.round(num(wastafels))),
        douches: douche && !bad ? 1 : 0,
        badDouches: bad ? 1 : 0,
      },
      buitenruimten: geenBuiten ? { geen: true } : { priveM2: num(buitenM2) },
      woz: { waardeEuro: woz, gebruiksoppervlakM2: Math.max(1, Math.round(totaalM2)) },
      energie: label ? { label } : { bouwjaar: Math.round(num(bouwjaar)) },
    };

    const r = checkHuurprijs({
      woning,
      contract: {
        startDatum: new Date(startDatum),
        type: contractType,
        eindDatum: contractType === "tijdelijk" && eindDatum ? new Date(eindDatum) : null,
      },
      bewoning: {
        aantalBewoners: Math.max(1, Math.round(num(aantalBewoners))),
        gemeenschappelijkeHuishouding: gemeenschappelijk,
      },
      ontvangtHuurtoeslag: huurtoeslag,
      kaleHuurCents: huurCents,
      // Heeft de huurder de keuken-/sanitair-extra's echt nagelopen? Zo niet,
      // rekent de marge-regel ze op het wettelijke maximum (pessimistisch).
      marge: { ...STANDAARD_MARGE, extrasOnbekend: !extrasIngevuld },
    });

    setResultaat(r);
    // Reproduceerbaarheid voor het pilot-logboek: bewaar de exacte invoer.
    setLaatsteInput(
      JSON.stringify({ woning, kaleHuurCents: huurCents, startDatum, contractType, huurtoeslag }),
    );
    setPilotStatus(null);
    // Alleen niet-herleidbare signalen naar analytics.
    track("huurprijs_check_done", {
      verdict: r.verdict,
      punten: r.puntenBasis,
      route: r.route.route,
    });
  }

  const brief = resultaat && resultaat.route.mogelijk ? huurverlagingsBrief(resultaat) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
        Betaal je te veel huur?
      </h1>
      <p className="mt-3 text-slate-600">
        Elke huurwoning heeft een puntenaantal volgens het officiële
        woningwaarderingsstelsel. Die punten bepalen wat je verhuurder{" "}
        <strong>maximaal</strong> mag vragen. Deze check rekent het uit op de
        regels van {HUURPRIJS_PEILDATUM.slice(0, 4)} — gratis, zonder DigiD, en
        je gegevens blijven in je browser.
      </p>

      <form onSubmit={bereken} className="mt-8 space-y-8">
        {/* ── Woning ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">1. Je woning</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Type woning</span>
              <select
                value={woonvorm}
                onChange={(e) => setWoonvorm(e.target.value as Woonvorm)}
                data-testid="hp-woonvorm"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="meergezins">Appartement / flat / etagewoning</option>
                <option value="eengezins">Eengezinswoning (rijtjeshuis)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">WOZ-waarde (€)</span>
              <input
                type="number"
                min={0}
                value={wozEuro}
                onChange={(e) => setWozEuro(e.target.value)}
                placeholder="bv. 285000"
                data-testid="hp-woz"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Gratis op te zoeken op{" "}
                <a
                  className="underline"
                  href="https://www.wozwaardeloket.nl/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  wozwaardeloket.nl
                </a>{" "}
                (peildatum 1-1-2025).
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Energielabel</span>
              <select
                value={label}
                onChange={(e) => setLabel(e.target.value as EnergieLabel | "")}
                data-testid="hp-label"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Weet ik niet — gebruik bouwjaar</option>
                {LABELS.map((l) => (
                  <option key={l} value={l}>
                    Label {l}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                Gratis op te zoeken op{" "}
                <a
                  className="underline"
                  href="https://www.ep-online.nl/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ep-online.nl
                </a>
                . Scheelt vaak tientallen punten.
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Met hoeveel mensen woon je hier?
              </span>
              <input
                type="number"
                min={1}
                value={aantalBewoners}
                onChange={(e) => setAantalBewoners(e.target.value)}
                data-testid="hp-bewoners"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Inclusief jezelf. Bij drie of meer bewoners bepaalt de wet een
                ander puntenstelsel — daarom vragen we het.
              </span>
            </label>

            {num(aantalBewoners) >= 3 ? (
              <label className="flex items-start gap-2 self-end pb-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={gemeenschappelijk}
                  onChange={(e) => setGemeenschappelijk(e.target.checked)}
                  data-testid="hp-huishouding"
                  className="mt-0.5"
                />
                <span>
                  We voeren een <strong>gezamenlijke huishouding</strong> (gezin,
                  familie) — geen losse huisgenoten die ieder hun eigen leven leiden.
                </span>
              </label>
            ) : null}

            {!label ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Bouwjaar</span>
                <input
                  type="number"
                  value={bouwjaar}
                  onChange={(e) => setBouwjaar(e.target.value)}
                  placeholder="bv. 1994"
                  data-testid="hp-bouwjaar"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            ) : null}
          </div>
        </section>

        {/* ── Ruimtes ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">2. Je ruimtes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Meet van muur tot muur. Een kamer telt alleen als vertrek als hij
            minstens 4 m² is; bergingen en zolders tellen als &quot;overige
            ruimte&quot; (¾ punt per m²).
          </p>

          <div className="mt-4 space-y-3">
            {ruimtes.map((r, i) => (
              <div key={r.id} className="grid grid-cols-12 items-center gap-2">
                <input
                  value={r.naam}
                  onChange={(e) =>
                    setRuimtes((rs) =>
                      rs.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)),
                    )
                  }
                  className="col-span-4 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={r.m2}
                  onChange={(e) =>
                    setRuimtes((rs) =>
                      rs.map((x, j) => (j === i ? { ...x, m2: e.target.value } : x)),
                    )
                  }
                  placeholder="m²"
                  data-testid={`hp-ruimte-m2-${i}`}
                  className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                />
                <select
                  value={r.soort}
                  onChange={(e) =>
                    setRuimtes((rs) =>
                      rs.map((x, j) =>
                        j === i ? { ...x, soort: e.target.value as RuimteSoort } : x,
                      ),
                    )
                  }
                  className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="vertrek">Vertrek</option>
                  <option value="overig">Overige ruimte</option>
                </select>
                <label className="col-span-2 flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={r.verwarmd}
                    onChange={(e) =>
                      setRuimtes((rs) =>
                        rs.map((x, j) => (j === i ? { ...x, verwarmd: e.target.checked } : x)),
                      )
                    }
                  />
                  verwarmd
                </label>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => voegRuimteToe("vertrek")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              + kamer
            </button>
            <button
              type="button"
              onClick={() => voegRuimteToe("overig")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              + berging / zolder
            </button>
            <span className="ml-auto self-center text-sm text-slate-500">
              totaal {totaalM2.toFixed(1)} m²
            </span>
          </div>
        </section>

        {/* ── Keuken, sanitair, buiten ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            3. Keuken, badkamer en buitenruimte
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Lengte aanrechtblad (cm)
              </span>
              <input
                type="number"
                min={0}
                value={aanrechtCm}
                onChange={(e) => setAanrechtCm(e.target.value)}
                placeholder="bv. 180"
                data-testid="hp-aanrecht"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Aantal wastafels</span>
              <input
                type="number"
                min={0}
                value={wastafels}
                onChange={(e) => setWastafels(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={toiletApart}
                onChange={(e) => setToiletApart(e.target.checked)}
              />
              Apart toilet (eigen ruimte)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={douche}
                onChange={(e) => setDouche(e.target.checked)}
              />
              Douche
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={bad} onChange={(e) => setBad(e.target.checked)} />
              Bad
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Balkon / tuin / dakterras (m²)
              </span>
              <input
                type="number"
                min={0}
                value={buitenM2}
                onChange={(e) => setBuitenM2(e.target.value)}
                disabled={geenBuiten}
                data-testid="hp-buiten"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={geenBuiten}
                onChange={(e) => setGeenBuiten(e.target.checked)}
              />
              Geen buitenruimte (kost 5 punten)
            </label>
          </div>

          <label className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={extrasIngevuld}
              onChange={(e) => setExtrasIngevuld(e.target.checked)}
              data-testid="hp-extras-ingevuld"
              className="mt-0.5"
            />
            <span>
              Ik heb hierboven <strong>alles</strong> nagelopen (ook luxe zoals
              inbouwapparatuur, thermostaatkranen en een tweede toilet). Vink je dit
              niet aan, dan rekenen we die extra&apos;s voor de zekerheid op het
              wettelijke maximum — dan is de uitkomst voorzichtiger.
            </span>
          </label>
        </section>

        {/* ── Contract ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">4. Je huurcontract</h2>
          <p className="mt-1 text-sm text-slate-600">
            Dit bepaalt of je überhaupt een procedure mág starten — vaak
            belangrijker dan het puntenaantal zelf.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Ingangsdatum huurcontract
              </span>
              <input
                type="date"
                value={startDatum}
                onChange={(e) => setStartDatum(e.target.value)}
                data-testid="hp-startdatum"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Soort contract</span>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as ContractType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="vast">Voor onbepaalde tijd</option>
                <option value="tijdelijk">Tijdelijk contract</option>
              </select>
            </label>

            {contractType === "tijdelijk" ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Einddatum contract</span>
                <input
                  type="date"
                  value={eindDatum}
                  onChange={(e) => setEindDatum(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Kale huur per maand (€)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={kaleHuur}
                onChange={(e) => setKaleHuur(e.target.value)}
                placeholder="bv. 1.150,00"
                data-testid="hp-huur"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Zonder servicekosten, gas/licht en internet.
              </span>
            </label>

            <label className="flex items-start gap-2 self-end pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={huurtoeslag}
                onChange={(e) => setHuurtoeslag(e.target.checked)}
                data-testid="hp-huurtoeslag"
                className="mt-0.5"
              />
              <span>
                Ik ontvang <strong>huurtoeslag</strong>. Belangrijk: die daalt mee
                als je huur omlaag gaat, dus je houdt minder over dan de verlaging
                op papier. We rekenen daar eerlijk mee.
              </span>
            </label>
          </div>
        </section>

        {fout ? (
          <p data-testid="hp-fout" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
            {fout}
          </p>
        ) : null}

        <button
          type="submit"
          data-testid="hp-submit"
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 sm:w-auto"
        >
          Bereken mijn punten
        </button>
      </form>

      {/* ── Resultaat ── */}
      {resultaat ? (
        <section data-testid="hp-resultaat" className="mt-10">
          <div className={`rounded-2xl border p-6 ${VERDICT_STYLE[resultaat.verdict].card}`}>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${VERDICT_STYLE[resultaat.verdict].pill}`}
            >
              {VERDICT_STYLE[resultaat.verdict].kop}
            </span>

            {resultaat.verdict === "onzelfstandig" ? (
              <div data-testid="hp-onzelfstandig" className="mt-4 text-sm text-slate-700">
                <p>
                  We tonen hier bewust <strong>geen puntenaantal</strong>: dat zou
                  met het verkeerde stelsel berekend zijn en je op het verkeerde
                  been zetten.
                </p>
                <p className="mt-3">
                  <a
                    className="font-medium text-brand-700 underline"
                    href="https://www.huurcommissie.nl/support/huurprijscheck/huurprijscheck-onzelfstandige-woonruimte"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Naar de officiële Huurprijscheck voor onzelfstandige woonruimte →
                  </a>
                </p>
              </div>
            ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Punten</div>
                <div data-testid="hp-punten" className="text-2xl font-bold text-slate-900">
                  {resultaat.puntenBasis}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Maximale kale huur
                </div>
                <div data-testid="hp-maxhuur" className="text-2xl font-bold text-slate-900">
                  {resultaat.maxHuurBasisCents == null
                    ? "—"
                    : formatEurCents(resultaat.maxHuurBasisCents)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Jij betaalt nu
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatEurCents(resultaat.kaleHuurCents)}
                </div>
              </div>
            </div>
            )}

            {resultaat.verdict === "kansrijk" ? (
              <div className="mt-4 text-sm text-slate-700">
                <p>
                  Ook als we voorzichtig rekenen (meetmarge, luxe die je misschien
                  vergeten bent) blijf je boven de maximale huurprijs. Minimaal{" "}
                  <strong>{formatEurCents(resultaat.maandVerlagingMinCents)}</strong> per
                  maand te veel — zo&apos;n{" "}
                  <strong>{formatEurCents(resultaat.jaarbesparingMinCents)}</strong> per
                  jaar.
                </p>
                {resultaat.huurtoeslagVolledigTeruggenomen ? (
                  <p data-testid="hp-netto-nul" className="mt-3 rounded-lg bg-amber-100 p-3 text-amber-900">
                    <strong>Maar let op:</strong> je huurtoeslag daalt euro voor euro
                    mee, dus netto houd je hier <strong>niets</strong> aan over. De
                    zaak is juridisch sterk, maar financieel schiet je er niets mee
                    op — en wij rekenen dan ook <strong>geen fee</strong>.
                  </p>
                ) : resultaat.nettoMaandVerlagingMinCents < resultaat.maandVerlagingMinCents ? (
                  <p data-testid="hp-netto" className="mt-3 rounded-lg bg-slate-100 p-3">
                    Je ontvangt huurtoeslag, dus die daalt mee. Je houdt er netto{" "}
                    <strong>ten minste{" "}
                    {formatEurCents(resultaat.nettoMaandVerlagingMinCents)}</strong> per
                    maand aan over. Onze fee gaat over dát bedrag, niet over de
                    verlaging op papier.
                  </p>
                ) : null}
              </div>
            ) : null}

            {resultaat.verdict === "twijfelgeval" ? (
              <p className="mt-4 text-sm text-slate-700">
                Volgens jouw invoer betaal je te veel, maar binnen de meetmarge kan het
                ook precies goed zijn. Laat de woning eerst exact opmeten — een
                procedure die je verliest kost je de € 25 leges.
              </p>
            ) : null}

            {resultaat.verdict === "geen_zaak" ? (
              <p className="mt-4 text-sm text-slate-700">
                Je huur zit op of onder het maximum dat bij {resultaat.puntenBasis}{" "}
                punten hoort. Er valt via deze route niets terug te halen — en dat is
                gewoon goed nieuws.
              </p>
            ) : null}
          </div>

          {/* Route */}
          <div
            data-testid="hp-route"
            className="mt-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <h3 className="font-semibold text-slate-900">{resultaat.route.titel}</h3>
            <p className="mt-2 text-sm text-slate-600">{resultaat.route.uitleg}</p>
            {resultaat.route.deadline ? (
              <p className="mt-2 text-sm font-medium text-amber-800">
                Let op: je hebt hiervoor tot{" "}
                {resultaat.route.deadline.toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            ) : null}
            {resultaat.route.mogelijk && !resultaat.route.terugwerkendTotContractstart ? (
              <p className="mt-2 text-sm text-slate-600">
                Je stuurt je verhuurder een voorstel met een ingangsdatum van minimaal
                twee volle kalendermaanden later — bij versturen vandaag is dat{" "}
                <strong>
                  {vroegsteIngangsdatum(new Date()).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                . Gaat de verhuurder niet akkoord, dan moet je de Huurcommissie
                inschakelen vóór{" "}
                {huurcommissieDeadline(vroegsteIngangsdatum(new Date())).toLocaleDateString(
                  "nl-NL",
                  { day: "numeric", month: "long", year: "numeric" },
                )}
                .
              </p>
            ) : null}
          </div>

          {/* Waarschuwingen */}
          {resultaat.waarschuwingen.length > 0 ? (
            <ul
              data-testid="hp-waarschuwingen"
              className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-sm text-amber-900"
            >
              {resultaat.waarschuwingen.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : null}

          {/* Puntenopbouw — niet tonen bij een ander stelsel */}
          {resultaat.verdict === "onzelfstandig" ? null : (
          <details className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Zo komen we aan {resultaat.puntenBasis} punten
            </summary>
            <dl className="mt-3 space-y-1 text-sm">
              {Object.entries(resultaat.rubrieken).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-100 py-1">
                  <dt className="text-slate-600">{k}</dt>
                  <dd className="tabular-nums text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Bij een ruime doorrekening (meetmarge + maximale luxe) komt de woning op{" "}
              {resultaat.puntenRuim} punten. Dat scenario gebruiken we om te bepalen of
              een zaak echt kansrijk is.
            </p>
          </details>
          )}

          {/* DIY-brief */}
          {brief ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Je brief — gratis</h3>
              <p className="mt-1 text-sm text-slate-600">
                Kopieer deze brief, vul je naam in en stuur hem zelf naar je verhuurder.
                Bewaar een kopie: die heb je nodig als de Huurcommissie eraan te pas komt.
              </p>
              <textarea
                data-testid="hp-brief"
                readOnly
                value={brief}
                rows={14}
                className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
              />
            </div>
          ) : null}

          {isAdmin ? (
            <div
              data-testid="hp-pilot"
              className="mt-6 rounded-xl border border-dashed border-slate-400 bg-slate-50 p-5"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Pilot-logboek (alleen zichtbaar voor admins)
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Bewaar deze uitkomst als proefzaak. Vul daarna in{" "}
                <Link className="underline" href="/admin/huurprijs-pilot">
                  het logboek
                </Link>{" "}
                in wat de officiële Huurprijscheck zegt — dat is gate A.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={pilotLabel}
                  onChange={(e) => setPilotLabel(e.target.value)}
                  placeholder="bv. moeder — Dorpsstraat 12"
                  data-testid="hp-pilot-label"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  data-testid="hp-pilot-save"
                  onClick={async () => {
                    setPilotStatus("Bezig…");
                    try {
                      const res = await fetch("/api/admin/huurprijs-pilot", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          label: pilotLabel || "naamloze proefzaak",
                          inputJson: laatsteInput,
                          onzePunten: resultaat.puntenBasis,
                          onzePuntenRuim: resultaat.puntenRuim,
                          onzeMaxHuurCents: resultaat.maxHuurBasisCents,
                          onsVerdict: resultaat.verdict,
                          onzeRoute: resultaat.route.route,
                          kaleHuurCents: resultaat.kaleHuurCents,
                        }),
                      });
                      setPilotStatus(
                        res.ok ? "Opgeslagen in het logboek." : "Opslaan mislukt.",
                      );
                    } catch {
                      setPilotStatus("Opslaan mislukt (netwerk).");
                    }
                  }}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  Bewaar als proefzaak
                </button>
              </div>
              {pilotStatus ? (
                <p data-testid="hp-pilot-status" className="mt-2 text-xs text-slate-700">
                  {pilotStatus}
                </p>
              ) : null}
            </div>
          ) : null}

          <PostCheckCta
            fromCheck="huurprijs"
            vondstCents={
              resultaat.verdict === "kansrijk" ? resultaat.jaarbesparingMinCents : null
            }
            vondstLabel="te veel betaalde huur per jaar"
          />

          <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <p>{HUURPRIJS_DISCLAIMER}</p>
            <p className="mt-2">
              Wil je het zelf natrekken? Dat kan gratis met de{" "}
              <a
                className="underline"
                href="https://huurprijscheck.huurcommissie.nl/zelfstandige-woonruimte"
                target="_blank"
                rel="noopener noreferrer"
              >
                officiële Huurprijscheck
              </a>{" "}
              van de Huurcommissie. Onze berekening is daarop gekalibreerd.{" "}
              <Link className="underline" href="/vind-al-je-geld">
                Alle checks →
              </Link>
            </p>
          </footer>
        </section>
      ) : null}
    </main>
  );
}
