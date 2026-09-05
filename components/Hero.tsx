import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";

/**
 * v28 — "vind al je geld" framing.
 *
 * v40 F1 — B-verbouwing: claims zijn het hart. Met de check-flags aan (prod)
 * opent de site claims-first (Box 3 / huur / energie / toeslagen, CTA naar de
 * hub) en wordt onderhandelen het bijproduct-linkje. Zonder flags blijft de
 * oude onderhandel-hero exact intact — geen dode links in een verse omgeving.
 * v41 — GRATIS PLATFORM. Er wordt nergens meer een fee genoemd of gevraagd.
 * Wat WEL blijft staan zijn de leges die de klant aan een DERDE betaalt
 * (Huurcommissie € 25, Geschillencommissie € 27,50 + € 52,50) — die staan op
 * de check-pagina's zelf. Die weghalen zou de site minder eerlijk maken.
 */
export default function Hero() {
  const geldCheckOn = isEnabled("GELD_CHECK_ENABLED");
  const claimsOn = isEnabled("CLAIMS");
  const hubOn = isEnabled("MONEYFINDER_HUB_ENABLED");
  const showBranches = geldCheckOn || claimsOn || hubOn;

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          {showBranches ? (
            <>
              Haal terug wat <span className="text-brand-600">van jou is</span>.
            </>
          ) : (
            <>
              Houd je geld in <span className="text-brand-600">eigen zak</span>.
            </>
          )}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
          {showBranches ? (
            <>
              Te veel betaalde <strong>Box 3-belasting</strong>, te hoge{" "}
              <strong>huur- of servicekosten</strong>, een foute{" "}
              <strong>energie-eindafrekening</strong>, gemiste{" "}
              <strong>toeslagen</strong>: check het in een minuut, zonder
              DigiD. Wij bereiden je claim voor — jij dient in en houdt de
              regie. Het gebruik is <strong>kosteloos</strong>: wij brengen
              geen fee, geen percentage over je teruggave en geen abonnement in
              rekening.
            </>
          ) : (
            <>
              Upload je energierekening of abonnementsfactuur. DeGeldHeld
              onderhandelt met je provider. Aan het gebruik zijn{" "}
              <strong>geen kosten</strong> verbonden.
            </>
          )}
        </p>

        <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={showBranches && hubOn ? "/vind-al-je-geld" : "/onderhandel"}
            className="w-full rounded-lg bg-brand-600 px-8 py-3 text-center font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
          >
            {showBranches && hubOn ? "Start een gratis check" : "Upload je rekening — gratis"}
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-slate-300 bg-white px-8 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Inloggen / account maken
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          {showBranches ? (
            <>
              Gratis en zonder DigiD · Officiële 2026-regels · Geen account
              nodig om te beginnen
            </>
          ) : (
            <>
              Geen account nodig om te beginnen · Volledig gratis · NL
              providers ondersteund
            </>
          )}
        </p>
        {showBranches ? (
          <p className="mt-4">
            <Link
              href="/proof"
              data-testid="hero-link-proof"
              className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
            >
              Bekijk ons live track record →
            </Link>
          </p>
        ) : (
          <p className="mt-4">
            <Link
              href="/demo"
              className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
            >
              Bekijk hoe het werkt (30 sec) →
            </Link>
          </p>
        )}
        {showBranches ? (
          <p className="mt-2">
            <Link
              href="/onderhandel"
              data-testid="hero-link-onderhandel"
              className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
            >
              Ook je vaste lasten verlagen? Upload je rekening, wij onderhandelen mee →
            </Link>
          </p>
        ) : hubOn ? (
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
