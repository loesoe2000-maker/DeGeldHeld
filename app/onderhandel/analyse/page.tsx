import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import Comparison from "@/components/Comparison";
import { buildComparison, isMonopolyCategory } from "@/lib/comparison";
import type { Country } from "@/lib/providers";
import { primaryFromLegacy } from "@/lib/categories";
import { infoFor } from "@/lib/category-info";
import CategoryInfoSection from "@/components/CategoryInfoSection";
import { pricesAreStale, pricesAsOfLabel } from "@/lib/market-prices";
import { hasMarketData, countryLabel } from "@/lib/market-coverage";
import { requiresPayment } from "@/lib/payments";
import { compareEnergy, type EnergyContractType } from "@/lib/categories/energie";
import { compareInsurance, type InsuranceCoverageType } from "@/lib/categories/verzekering";
import { compareMortgage } from "@/lib/categories/hypotheek";
import { compareWater } from "@/lib/categories/water";
import { ANON_COOKIE_NAME, isValidAnonSessionId } from "@/lib/anon-session";
import AnonymousMailPrompt from "@/components/AnonymousMailPrompt";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analyse — DeGeldHeld" };

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string; paid?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const billId = params.bill;
  if (!billId) redirect("/onderhandel");

  // v15 anonymous flow: when there's no session, look up the bill via
  // the anonymous-session cookie. We still scope by cookie so visitor
  // A can't read visitor B's bills.
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const cookieStore = await cookies();
  const anonCookie = cookieStore.get(ANON_COOKIE_NAME)?.value ?? null;
  const anonymousSessionId = isValidAnonSessionId(anonCookie) ? anonCookie : null;

  if (!userId && !anonymousSessionId) {
    redirect("/onderhandel");
  }

  const bill = userId
    ? await prisma.bill.findFirst({ where: { id: billId, userId } })
    : await prisma.bill.findFirst({ where: { id: billId, anonymousSessionId } });
  if (!bill) redirect("/onderhandel");

  const isAnonymous = !userId;

  // DEEL 10 paywall — first bill free, others require payment first.
  // Anonymous flow skips paywall entirely; we want them to see value
  // before any signup gate.
  if (userId && (await requiresPayment(userId, billId))) {
    redirect(`/pay/${billId}?type=paywall`);
  }

  // Empty bill → OCR couldn't extract usable data. Show a graceful fallback
  // instead of letting Comparison render an empty page or silently failing.
  const ocrFailed = bill.amountCents <= 0 || bill.provider === "Onbekend" || bill.provider === "";
  const isHeicFailure = ocrFailed && bill.rawOcr?.startsWith("HEIC_CONVERT_FAILED");
  if (ocrFailed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900">
          {isHeicFailure
            ? "iPhone HEIC kunnen we nog niet uitlezen"
            : "We konden je rekening niet automatisch uitlezen"}
        </h1>
        <p className="mt-3 text-slate-600">
          {isHeicFailure ? (
            <>
              Open de foto in <strong>Foto&apos;s</strong> op je iPhone, tik op{" "}
              <strong>Deel → Kopieer foto</strong>, plak 'm hier opnieuw — dan
              komt 'ie als JPEG binnen. Of zet je iPhone op JPEG via{" "}
              <strong>Instellingen → Camera → Indelingen → Meest compatibel</strong>{" "}
              en maak een nieuwe foto.
            </>
          ) : (
            <>
              De OCR herkende geen provider of bedrag. Dit gebeurt soms bij
              onscherpe foto&apos;s, handgeschreven facturen of een onbekende
              leverancier.
            </>
          )}
        </p>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Wat we wel zagen:</strong>
          <ul className="mt-2 list-disc pl-5">
            <li>Provider: {bill.provider || "—"}</li>
            <li>Bedrag: {bill.amountCents > 0 ? `€${(bill.amountCents / 100).toFixed(2)}` : "—"}</li>
            <li>Plan: {bill.plan ?? "—"}</li>
          </ul>
          {bill.rawOcr && (
            <details className="mt-3 text-xs opacity-80">
              <summary className="cursor-pointer font-medium">Debug-info (technisch)</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-amber-100 p-2">
                {bill.rawOcr}
              </pre>
            </details>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/onderhandel"
            className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Probeer opnieuw met scherpere foto
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Terug naar dashboard
          </Link>
        </div>
      </main>
    );
  }

  // v3.1: compare op het maand-abonnement (niet het totaal incl. eenmalige
  // posten). bill.amountCents is al door upload-route op monthly gezet als die
  // beschikbaar is, maar oude records kunnen alleen totalCents/amountCents hebben.
  const comparisonAmount = bill.monthlyCents ?? bill.amountCents;
  const billCountry = (bill.country as Country | null) ?? "NL";
  const comparison = buildComparison({
    provider: bill.provider,
    category: bill.category,
    amountCents: comparisonAmount,
    country: billCountry,
  });
  // v18 honesty gate: for categories whose market data is NL-only,
  // a non-NL invoice can't get an exact comparison. Show provider +
  // amount, but replace the savings maths with an honest banner.
  const marketDataCovered = hasMarketData(bill.category, billCountry);

  // Toon blauwe info-balk als factuur eenmalige posten bevat (>5% verschil
  // tussen total en monthly).
  const showOneTimeBanner =
    bill.monthlyCents != null &&
    bill.totalCents != null &&
    bill.totalCents > 0 &&
    Math.abs(bill.totalCents - bill.monthlyCents) / bill.totalCents > 0.05;
  const oneTimeDeltaCents = showOneTimeBanner
    ? (bill.totalCents ?? 0) - (bill.monthlyCents ?? 0)
    : 0;

  // v3.1: stale-warning bij factuur >180 dagen oud (markt-prijzen zijn dan
  // mogelijk niet meer representatief).
  const STALE_DAYS = 180;
  const invoiceAgeDays =
    bill.invoiceDate != null
      ? Math.floor((Date.now() - new Date(bill.invoiceDate).getTime()) / (24 * 60 * 60 * 1000))
      : null;
  const showStaleBanner = invoiceAgeDays != null && invoiceAgeDays > STALE_DAYS;
  const ageMonths = invoiceAgeDays != null ? Math.floor(invoiceAgeDays / 30) : 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Analyse</h1>
      <p className="mt-2 text-slate-600">
        Op basis van je {bill.provider}-rekening hebben we de markt gecheckt.
      </p>
      {showStaleBanner && (
        <div
          role="alert"
          data-testid="stale-banner"
          className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <strong>Deze factuur is {ageMonths} maanden oud</strong> — markt-prijzen
          kunnen gewijzigd zijn. Upload een recente factuur voor nauwkeurig advies.
        </div>
      )}
      {showOneTimeBanner && (
        <div
          role="status"
          data-testid="onetime-banner"
          className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
        >
          <strong>Eenmalige posten op deze factuur.</strong> Je factuur bevat{" "}
          €{(oneTimeDeltaCents / 100).toFixed(2).replace(".", ",")} aan eenmalige
          posten. We vergelijken op je vaste maand-abonnement van{" "}
          €{((bill.monthlyCents ?? 0) / 100).toFixed(2).replace(".", ",")}.
        </div>
      )}
      {isMonopolyCategory(bill.category, (bill.country as Country | null) ?? "NL") && (
        <div
          role="status"
          data-testid="monopoly-banner"
          className="mt-6 rounded-xl border border-slate-300 bg-slate-50 p-5 text-sm text-slate-900"
        >
          <h2 className="text-base font-semibold">Dit is een regio-monopolie</h2>
          <p className="mt-1">
            Onderhandelen heeft hier weinig effect — je kunt niet overstappen
            naar een andere leverancier. Wel kun je besparen door je verbruik
            te verlagen.
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>Controleer of er kwijtschelding mogelijk is bij laag inkomen.</li>
            <li>Check water-besparingstips (douche timer, kraan-perlator).</li>
            <li>Stel automatische incasso in om aanmaningskosten te voorkomen.</li>
          </ul>
        </div>
      )}
      {!marketDataCovered && (
        <div
          data-testid="country-coverage-banner"
          className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900"
        >
          <h2 className="text-base font-semibold">
            {countryLabel(billCountry)} markt nog niet volledig ondersteund
          </h2>
          <p className="mt-1">
            We tonen je provider en bedrag, maar we hebben de{" "}
            {countryLabel(billCountry)} markt voor deze categorie nog niet
            volledig gevalideerd. Dit is een <strong>indicatie</strong>, geen
            exacte vergelijking. Nederlandse facturen krijgen het
            nauwkeurigste advies.
          </p>
          <p className="mt-2">
            <strong>{bill.provider}</strong> ·{" "}
            €{(comparisonAmount / 100).toFixed(2).replace(".", ",")}/maand
          </p>
        </div>
      )}

      {marketDataCovered && (
        <div className="mt-8">
          <Comparison result={comparison} subType={bill.subType} />
        </div>
      )}

      <CategoryInfoSection
        primary={primaryFromLegacy(bill.category)}
        info={infoFor(primaryFromLegacy(bill.category))}
      />

      {marketDataCovered && bill.category === "WATER" && (() => {
        // v17: water is a regional monopoly — savings come from usage
        // reduction, not switching. The m³-rate comes from OCR when
        // available (energyM3RateCents doubles as the water m³ field).
        const r = compareWater({
          m3PriceCents: bill.energyM3RateCents,
          jaarverbruikM3: null,
          householdSize: null,
        });
        return (
          <div data-testid="cat-water" className="mt-8 rounded-xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-900">
            <h2 className="text-base font-semibold">Water — verbruik & besparing</h2>
            <span data-testid="water-monopoly-badge" className="mt-1 inline-block rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
              regionaal monopolie — overstappen kan niet
            </span>
            <p className="mt-2">Markt-mediaan €{(r.marketM3Cents / 100).toFixed(2)}/m³ · geschat verbruik {r.avgHouseholdM3} m³/jaar · geschatte jaarkosten <strong>€{(r.estimatedAnnualCents / 100).toFixed(0)}</strong>.</p>
            <h3 className="mt-3 font-semibold">Zo bespaar je op water</h3>
            <ul className="mt-1 list-disc pl-5">
              {r.reductionTips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
            {r.kwijtscheldingEligible && (
              <p className="mt-2">Mogelijk kom je in aanmerking voor kwijtschelding bij laag inkomen — check je gemeente/waterschap.</p>
            )}
            {r.notes.map((n, i) => <p key={i} className="mt-1 opacity-80">{n}</p>)}
          </div>
        );
      })()}

      {marketDataCovered && bill.category === "ENERGIE" && (() => {
        // v17: feed the REAL OCR-extracted kWh/m³ rates + contract type.
        const detected =
          bill.energyKwhRateCents != null || bill.energyM3RateCents != null;
        const r = compareEnergy({
          kwhPriceCents: bill.energyKwhRateCents,
          m3PriceCents: bill.energyM3RateCents,
          vastrechtCents: null,
          contractType: (bill.energyContractType as EnergyContractType) ?? "unknown",
        });
        return (
          <div data-testid="cat-energie" className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <h2 className="text-base font-semibold">Energie-tarief vergelijking</h2>
            {!detected && (
              <span data-testid="energie-estimate-badge" className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                tarief niet gedetecteerd — schatting op gemiddeld verbruik
              </span>
            )}
            <p className="mt-1">Markt-mediaan kWh ({(bill.energyContractType ?? "variabel")}): <strong>€{(r.marketKwhCents / 100).toFixed(2)}</strong>, gas m³: <strong>€{(r.marketM3Cents / 100).toFixed(2)}</strong>.</p>
            <p className="mt-1">Geschatte jaarbesparing bij overstap naar markt-tarief: <strong>€{(r.annualSavingsCents / 100).toFixed(0)}</strong>.</p>
            {r.notes.map((n, i) => <p key={i} className="mt-1 opacity-80">{n}</p>)}
          </div>
        );
      })()}

      {marketDataCovered && bill.category === "VERZEKERING" && (() => {
        // v17: use the REAL coverage type + deductible from OCR.
        const coverage = ((): InsuranceCoverageType => {
          const c = (bill.insuranceCoverage ?? "").toUpperCase();
          if (c === "WA" || c === "WA+" || c === "CASCO") return c as InsuranceCoverageType;
          return "UNKNOWN";
        })();
        const r = compareInsurance({
          type: coverage,
          premiumMonthlyCents: bill.monthlyCents ?? bill.amountCents,
          deductibleCents: bill.insuranceDeductibleCents,
        });
        return (
          <div data-testid="cat-verzekering" className="mt-8 rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
            <h2 className="text-base font-semibold">Verzekering-vergelijking</h2>
            {coverage === "UNKNOWN" && (
              <span data-testid="verzekering-estimate-badge" className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                dekking niet gedetecteerd — vergelijking op premie-percentiel
              </span>
            )}
            <p className="mt-1">Je premie zit in het <strong>{r.percentile === "high" ? "duurste kwartiel" : r.percentile === "low" ? "goedkoopste kwartiel" : "midden"}</strong> van de markt.</p>
            {r.alternatives.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {r.alternatives.map((a) => (
                  <li key={a.name}>
                    <strong>{a.name}</strong>: €{(a.premiumMonthlyCents / 100).toFixed(2)}/mnd ({a.notes}) — bespaart €{(a.yearlySavingsCents / 100).toFixed(0)}/jaar
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">Geen goedkopere alternatieven gevonden met vergelijkbare dekking.</p>
            )}
          </div>
        );
      })()}

      {marketDataCovered && bill.category === "HYPOTHEEK" && (() => {
        // v17: use REAL OCR rente + rentevaste-periode. Restschuld is
        // rarely on a monthly invoice → estimate conservatively from
        // the monthly payment and LABEL it as an estimate.
        const maandlast = bill.monthlyCents ?? bill.amountCents;
        const rateDetected = bill.mortgageInterestPct != null;
        const termDetected = bill.mortgageTermYears != null;
        // Rough restschuld estimate: monthly × 12 × remaining term.
        // Conservative — clamped to a sane band so a tiny invoice
        // doesn't produce a silly tiny mortgage.
        const estTermYears = bill.mortgageTermYears ?? 20;
        const estRestschuldCents = Math.max(
          5_000_000, // €50k floor
          Math.min(maandlast * 12 * estTermYears, 100_000_000), // €1M ceiling
        );
        const r = compareMortgage({
          restschuldCents: estRestschuldCents,
          rentePercentage: bill.mortgageInterestPct ?? 4.5,
          rentevasteJaren: bill.mortgageTermYears ?? 10,
          looptijdJaren: estTermYears,
          maandlastCents: maandlast,
        });
        const anyEstimate = !rateDetected || !termDetected;
        return (
          <div data-testid="cat-hypotheek" className="mt-8 rounded-xl border border-purple-200 bg-purple-50 p-5 text-sm text-purple-900">
            <h2 className="text-base font-semibold">Hypotheek oversluit-kalkulator</h2>
            {anyEstimate && (
              <span data-testid="hypotheek-estimate-badge" className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                {!rateDetected ? "rente geschat" : "rente uit factuur"} · restschuld is altijd een schatting uit je maandlast
              </span>
            )}
            <p className="mt-1">Markt-rente {r.marketRatePct}% vs jouw {rateDetected ? "" : "geschatte "}{r.yourRatePct}% — verschil <strong>{r.rateDeltaPct}%</strong>.</p>
            <p className="mt-1">Bruto jaarbesparing: €{(r.yearlySavingsGrossCents / 100).toFixed(0)} (na oversluitkosten: €{(r.yearlySavingsNetCents / 100).toFixed(0)}/jaar gemiddeld).</p>
            <p className="mt-1"><strong>{r.oversluitWorthIt ? "Oversluiten is rendabel" : "Oversluiten loont waarschijnlijk niet"}</strong> — terugverdientijd {r.paybackMonths >= 0 ? `${r.paybackMonths} maanden` : "n.v.t."}.</p>
            {r.notes.map((n, i) => <p key={i} className="mt-1 opacity-80">{n}</p>)}
          </div>
        );
      })()}

      {isAnonymous ? (
        <AnonymousMailPrompt
          billId={bill.id}
          provider={bill.provider}
          yearlySavingsCents={comparison.bestSavingsCents}
        />
      ) : (
        <div className="mt-10 flex gap-3">
          <Link
            href={`/onderhandel/email?bill=${bill.id}`}
            className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Genereer onderhandel-email
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuleren
          </Link>
        </div>
      )}

      <p data-testid="prices-asof" className="mt-8 text-xs text-slate-400">
        {pricesAreStale()
          ? `Let op: markt-prijzen zijn voor het laatst bijgewerkt op ${pricesAsOfLabel()} — mogelijk niet meer actueel.`
          : `Markt-prijzen voor het laatst bijgewerkt op ${pricesAsOfLabel()}.`}
      </p>
    </main>
  );
}
