import { redirect } from "next/navigation";
import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import {
  EN_HERO,
  EN_TILES,
  EN_HOW_IT_WORKS,
  EN_FEE_NOTE,
  EN_TRUST,
} from "@/lib/i18n-en";
import TrackEvent from "@/components/TrackEvent";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "DeGeldHeld — claim the Dutch money you're owed",
  description:
    "For internationals in the Netherlands: reclaim Box 3 tax, rent service-cost " +
    "refunds, energy corrections and missed allowances. Free check, no cure no pay.",
  // Bewust index:false zolang de EN-lancering niet af is (soft launch via
  // directe link; LinkedIn heeft geen Google-indexering nodig). follow:true
  // WÉL: anders blokkeren we zonder reden linkwaarde naar de NL-checks.
  robots: { index: false, follow: true },
};

/**
 * v38 uitbreiding A — Engelstalige landingslaag voor internationals in NL.
 *
 * Geïsoleerd: raakt GEEN bestaande NL-route. Alle tegels linken naar de
 * bestaande NL-checks (die blijven Nederlands — dat is bewust). Flag-gated
 * (EN_LANDING_ENABLED, default off) zodat 'm pas live gaat na copy-review.
 */
export default function EnglishLandingPage() {
  if (!isEnabled("EN_LANDING_ENABLED")) redirect("/");

  // Toon alléén tegels waarvan de doel-check-flag aan staat: een tegel naar
  // een uitgezette check zou stil doodlopen op een redirect naar de
  // Nederlandse homepage — precies wat een Engelstalige bezoeker niet snapt.
  const tiles = EN_TILES.filter((t) => isEnabled(t.flag));

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-10 sm:pt-16">
      <TrackEvent event="en_landing_view" />

      {/* Hero */}
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          {EN_HERO.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-5xl">
          {EN_HERO.title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          {EN_HERO.subtitle}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="#claims"
            className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {EN_HERO.ctaPrimary}
          </a>
          <a
            href="#how"
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {EN_HERO.ctaSecondary}
          </a>
        </div>
      </header>

      {/* Claim-tegels → bestaande NL-checks */}
      <section id="claims" className="mt-14 scroll-mt-8">
        <h2 className="text-2xl font-bold text-slate-900">What you can claim</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              data-testid={`en-tile-${t.href.replace(/\//g, "")}`}
              className="group rounded-2xl border border-brand-200 bg-white p-6 shadow-sm transition hover:border-brand-400 hover:shadow-md"
            >
              <div className="text-3xl" aria-hidden>
                {t.emoji}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {t.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{t.body}</p>
              <p className="mt-3 text-sm font-medium text-brand-700 group-hover:text-brand-800">
                Start free check →
              </p>
            </Link>
          ))}
        </div>
        {tiles.length === 0 ? (
          <p
            data-testid="en-tiles-empty"
            className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600"
          >
            The checks are being rolled out — email{" "}
            <a className="underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>{" "}
            and we'll let you know the moment they open.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-500">
          The checks themselves are in Dutch — but they need no DigiD and take a
          minute. Prefer help in English? Email{" "}
          <a className="underline" href="mailto:hallo@degeldheld.com">
            hallo@degeldheld.com
          </a>
          .
        </p>
      </section>

      {/* Hoe het werkt */}
      <section id="how" className="mt-16 scroll-mt-8">
        <h2 className="text-2xl font-bold text-slate-900">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {EN_HOW_IT_WORKS.map((s) => (
            <li key={s.n} className="rounded-xl bg-brand-50 p-6">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-bold text-white"
                aria-hidden
              >
                {s.n}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Eerlijke kosten-noot — hoort direct onder no-cure-no-pay */}
      <p
        data-testid="en-fee-note"
        className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-sm leading-relaxed text-amber-900"
      >
        {EN_FEE_NOTE}
      </p>

      {/* Trust / disclaimer */}
      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-5 text-xs leading-relaxed text-slate-600">
        {EN_TRUST.disclaimer}
      </section>

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/" className="underline">
          View the Dutch site →
        </Link>
      </div>
    </main>
  );
}
