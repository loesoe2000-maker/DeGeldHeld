import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";

/**
 * v28 — "vind al je geld" framing. Naast de bestaande primaire weg
 * (rekeningen-onderhandeling) tonen we, alleen áls hun feature-flag aan staat,
 * de twee gratis instap-checks: toeslagen + (later) vluchtclaim. Geen flag aan
 * → de pagina ziet er hetzelfde uit als vóór v28 (geen lege of dode UI).
 */
export default function Hero() {
  const geldCheckOn = isEnabled("GELD_CHECK_ENABLED");
  const claimsOn = isEnabled("CLAIMS");
  const hubOn = isEnabled("MONEYFINDER_HUB_ENABLED");
  const showBranches = geldCheckOn || claimsOn;

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Houd je geld in <span className="text-brand-600">eigen zak</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
          {showBranches ? (
            <>
              Vind <strong>al je geld</strong>: onderhandel je rekeningen,
              check welke <strong>toeslagen</strong> je misloopt
              {claimsOn ? <> en haal geld terug van een <strong>vertraagde vlucht</strong></> : null}.
              Je betaalt alleen <strong>20% van wat we besparen</strong> op je rekeningen — de checks zijn gratis.
            </>
          ) : (
            <>
              Upload je telefoon-, internet- of energierekening. DeGeldHeld
              onderhandelt automatisch met je provider en je betaalt alleen
              <strong> 20% van wat we besparen</strong>.
            </>
          )}
        </p>

        <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/onderhandel"
            className="w-full rounded-lg bg-brand-600 px-8 py-3 text-center font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
          >
            Upload je rekening — gratis
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-slate-300 bg-white px-8 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Inloggen / account maken
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Geen account of betaling nodig om te proberen · Niet bespaard? Niets te
          betalen · NL providers ondersteund
        </p>
        <p className="mt-4">
          <Link
            href="/demo"
            className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
          >
            Bekijk hoe het werkt (30 sec) →
          </Link>
        </p>
        {hubOn ? (
          <p className="mt-2">
            <Link
              href="/vind-al-je-geld"
              data-testid="hero-link-hub"
              className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
            >
              Of bekijk alle checks op één plek: vind al je geld →
            </Link>
          </p>
        ) : null}

        {showBranches ? (
          <section
            data-testid="hero-branches"
            aria-labelledby="hero-branches-heading"
            className="mt-14 grid gap-4 text-left sm:grid-cols-2"
          >
            <h2
              id="hero-branches-heading"
              className="col-span-full text-center text-sm font-semibold uppercase tracking-wider text-slate-500"
            >
              Of vind je geld gratis met een check
            </h2>

            {geldCheckOn ? (
              <Link
                href="/geld-check"
                data-testid="hero-branch-geld-check"
                className="group rounded-2xl border border-brand-200 bg-white p-6 shadow-sm transition hover:border-brand-400 hover:shadow-md"
              >
                <div className="text-2xl">💸</div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  Toeslagen + gemeente-regelingen
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Eén vragenlijst, geen DigiD. Indicatie van zorgtoeslag,
                  huurtoeslag, kindgebonden budget + gemeente-regelingen — op
                  de officiële 2026-grenzen.
                </p>
                <p className="mt-3 text-sm font-medium text-brand-700 group-hover:text-brand-800">
                  Doe de gratis check →
                </p>
              </Link>
            ) : null}

            {claimsOn ? (
              <Link
                href="/vluchtclaim"
                data-testid="hero-branch-vluchtclaim"
                className="group rounded-2xl border border-brand-200 bg-white p-6 shadow-sm transition hover:border-brand-400 hover:shadow-md"
              >
                <div className="text-2xl">✈️</div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  Vluchtclaim (EU261)
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Was je vlucht vertraagd? Vul je vluchtnummer + datum in en we
                  kijken of je recht hebt op € 250 – € 600. No cure, no pay op
                  het teruggehaalde bedrag.
                </p>
                <p className="mt-3 text-sm font-medium text-brand-700 group-hover:text-brand-800">
                  Check je vlucht →
                </p>
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}
