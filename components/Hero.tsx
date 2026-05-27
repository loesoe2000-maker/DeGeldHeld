import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";

/**
 * v28 — "vind al je geld" framing. Naast de bestaande primaire weg
 * (rekeningen-onderhandeling) tonen we, alleen áls hun feature-flag aan staat,
 * de twee gratis instap-checks: toeslagen + (later) vluchtclaim. Geen flag aan
 * → de pagina ziet er hetzelfde uit als vóór v28 (geen lege of dode UI).
 *
 * v32 — fee-integriteit: fallback-copy noemt geen telecom/internet meer,
 * want TELECOM is sinds V30 fee:false (Plus-belscript, geen 20%-NCNP). De
 * NCNP-categorieën zijn energie / bank / software-saaS / overig abonnement.
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
              {" "}<strong>No cure, no pay</strong> — je betaalt alléén als we daadwerkelijk geld voor je halen. De checks zijn altijd gratis.
            </>
          ) : (
            <>
              Upload je energierekening of abonnementsfactuur. DeGeldHeld
              onderhandelt automatisch met je provider en je betaalt{" "}
              <strong>alléén bij succes</strong> — no cure, no pay.
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

        {/* v36 — Hero-branches strip verwijderd: MoneyfinderHubBanner direct
            onder de Hero (zie app/page.tsx) toont 6 tegels prominenter,
            waaronder Toeslagen + gemeente-regelingen. Hier dubbel = verwarrend. */}
      </div>
    </section>
  );
}
