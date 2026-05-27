import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";

/**
 * v36 — prominente sectie tussen Hero en de rest van de homepage. Trekt
 * mensen die NIET hier zijn om een rekening te onderhandelen — wel om hun
 * toeslagen / Box 3 / NS / huurcommissie / energie te checken. Alleen
 * zichtbaar als MONEYFINDER_HUB_ENABLED-flag aan staat (anders verschijnt er
 * niets, geen lege strip).
 *
 * Bewust gebouwd als een 2e CTA-zone na Hero — niet als slide/carousel
 * (carousels werken slecht voor SEO + UX op mobiel).
 */
export default function MoneyfinderHubBanner() {
  if (!isEnabled("MONEYFINDER_HUB_ENABLED")) return null;

  // Per check een tegel met emoji + label. Alleen tonen als de bijbehorende
  // flag aan staat — anders is de tegel onnodig (geen lege links).
  const tiles = [
    { emoji: "💸", label: "Toeslagen + gemeente", href: "/geld-check", flag: "GELD_CHECK_ENABLED" as const },
    { emoji: "🏛️", label: "Box 3-rechtsherstel", href: "/box3-check", flag: "BOX3_CHECK_ENABLED" as const },
    { emoji: "🩺", label: "Zorgkostenaftrek", href: "/zorgkosten-check", flag: "ZORGKOSTEN_CHECK_ENABLED" as const },
    { emoji: "🚆", label: "NS-vertraging", href: "/ns-check", flag: "NS_CHECK_ENABLED" as const },
    { emoji: "🏠", label: "Huurcommissie", href: "/huurcommissie-check", flag: "HUURCOMMISSIE_CHECK_ENABLED" as const },
    { emoji: "⚡", label: "Energie-eindafrekening", href: "/energie-claim-check", flag: "ENERGIE_CLAIM_CHECK_ENABLED" as const },
  ];

  const visibleTiles = tiles.filter((t) => isEnabled(t.flag));
  if (visibleTiles.length === 0) return null;

  return (
    <section
      data-testid="moneyfinder-hub-banner"
      className="bg-brand-50/60 px-6 py-16 sm:py-20"
      aria-labelledby="moneyfinder-banner-heading"
    >
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          Of: vind je geld zonder iets te uploaden
        </p>
        <h2
          id="moneyfinder-banner-heading"
          className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
        >
          {visibleTiles.length} gratis checks · 1 minuut · geen DigiD
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          Naast onderhandelen helpen we je het geld te vinden dat je laat
          liggen: toeslagen die je misloopt, Box 3-belasting die je terug kunt
          vragen, NS-vertragingen die je nooit hebt geclaimd, en meer. Indicatie
          op de officiële 2026-regels — je gegevens blijven in je browser.
        </p>

        <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleTiles.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                data-testid={`moneyfinder-banner-tile-${t.href.slice(1)}`}
                className="group flex h-full items-center gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 shadow-sm transition hover:border-brand-500 hover:shadow-md"
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="flex-1">{t.label}</span>
                <span className="text-brand-600 group-hover:text-brand-700">→</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            href="/vind-al-je-geld"
            data-testid="moneyfinder-banner-cta"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Bekijk alle checks op één plek →
          </Link>
        </div>
      </div>
    </section>
  );
}
