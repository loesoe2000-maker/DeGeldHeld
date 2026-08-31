import { redirect } from "next/navigation";
import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import { activeHubTiles, HUB_TILES, SPOOK_TILE } from "@/lib/moneyfinder-hub";
import TrackEvent from "@/components/TrackEvent";

export const dynamic = "force-dynamic";
export const metadata = {
  // Géén "— DeGeldHeld" in de title: het layout-template "%s · DeGeldHeld"
  // plakt het merk er al achter (dubbel merk stond live in de <title>).
  title: "Vind al je geld",
  description:
    "Alle DeGeldHeld-checks op één plek: toeslagen + Box 3 + zorgkosten + " +
    "vluchtclaim + NS-vertraging + spookabonnementen.",
  // Eigen openGraph-blok: zonder dit erfde deze pagina de og:title/description
  // van de homepage ("upload je rekening…") — de verkeerde propositie voor wie
  // deze link deelt. App Router vervangt het parent-blok, dus alles expliciet.
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: "/vind-al-je-geld",
    siteName: "DeGeldHeld",
    title: "Vind al je geld — alle checks op één plek",
    description:
      "Toeslagen, Box 3-rechtsherstel, zorgkosten, huurcommissie, energie, " +
      "NS-vertraging en spookabonnementen — gratis checks, no cure no pay.",
    images: [
      { url: "/api/og?title=Vind%20al%20je%20geld", width: 1200, height: 630 },
    ],
  },
};

/**
 * v29 DEEL 4 — centrale "vind al je geld"-hub. Tegels alleen actief als hun
 * eigen feature-flag aan staat (geen lege/dode UI).
 */
export default function VindAlJeGeldPage() {
  if (!isEnabled("MONEYFINDER_HUB_ENABLED")) redirect("/");
  const tiles = activeHubTiles(isEnabled);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-10 sm:pt-14">
      <TrackEvent event="moneyfinder_hub_view" />
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Vind al je geld
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Alles op één plek — checks en claims
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          DeGeldHeld brengt alle "vind het geld dat je laat liggen"-routes bij
          elkaar: toeslagen, Box 3-rechtsherstel, zorgkostenaftrek, vluchtclaim,
          NS-vertraging en spookabonnementen. Indicatie ≠ advies; je gegevens
          blijven client-side waar het kan.
        </p>
      </header>

      {tiles.length === 0 ? (
        <section
          data-testid="hub-empty"
          className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            Nog niets actief
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            De individuele checks staan klaar maar zijn nog niet aangezet. De
            eigenaar zet ze stuk-voor-stuk live zodra de privacy/disclaimer per
            feature is gereviewed.
          </p>
        </section>
      ) : (
        <section
          data-testid="hub-grid"
          className="mt-10 grid gap-4 sm:grid-cols-2"
        >
          {tiles.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              data-testid={`hub-tile-${t.id}`}
              className="group rounded-2xl border border-brand-200 bg-white p-6 shadow-sm transition hover:border-brand-400 hover:shadow-md"
            >
              <div className="text-2xl" aria-hidden>
                {t.icon}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{t.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{t.body}</p>
              <p className="mt-3 text-sm font-medium text-brand-700 group-hover:text-brand-800">
                Open →
              </p>
            </Link>
          ))}
        </section>
      )}

      {/* Spookabonnementen is owner-scoped (login-vereist), geen flag — toon altijd. */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Ook beschikbaar
        </h2>
        <Link
          href={SPOOK_TILE.href}
          data-testid={`hub-tile-${SPOOK_TILE.id}`}
          className="mt-3 block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md"
        >
          <div className="text-2xl" aria-hidden>
            {SPOOK_TILE.icon}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{SPOOK_TILE.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{SPOOK_TILE.body}</p>
          <p className="mt-3 text-sm font-medium text-brand-700">Open →</p>
        </Link>
      </section>

      {/* Plus-pitch onderaan. */}
      <section className="mt-12 rounded-2xl bg-brand-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Eén abonnement = elke maand opnieuw checken
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          DeGeldHeld Plus scant je vaste lasten + her-checkt toeslagen/Box 3/
          zorgkosten + claimt automatisch je NS-vertragingen. Vanaf € 4,99/mnd,
          opzegbaar elk moment.
        </p>
        <Link
          href="/plus"
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Bekijk Plus →
        </Link>
      </section>

      {/* Defensieve listing — toont in code/devtools dat we ALLE tegels wel kennen,
          ook al verbergen we ze (debug-handig). Niet rendered in normal flow. */}
      <span data-testid="hub-all-tiles" className="sr-only">
        {HUB_TILES.map((t) => t.id).join(",")}
      </span>
    </main>
  );
}
