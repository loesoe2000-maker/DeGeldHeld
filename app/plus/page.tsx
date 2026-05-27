import Link from "next/link";
import { PLUS_PILLARS, PLUS_PRICE } from "@/lib/plus";

export const dynamic = "force-static";
export const metadata = {
  title: "DeGeldHeld Plus — vaste lasten her-scannen + toeslagen her-checken",
  description:
    "Eén abonnement dat élke maand opnieuw kijkt of je geld misloopt: vaste lasten, " +
    "toeslagen + gemeente-regelingen, en alerts op contract-einde en prijsstijgingen.",
};

/**
 * v28 DEEL 3 — positionering-pagina voor DeGeldHeld Plus. Géén live Stripe-
 * billing hier (live-flip wacht op KYC — zie CLAUDE.md); deze pagina vertelt
 * de waarde + neemt e-mailadressen op via mailto, zodat de eigenaar mensen
 * kan benaderen zodra Stripe live staat.
 */
export default function PlusPage() {
  const lowEur = PLUS_PRICE.lowEur.toFixed(2).replace(".", ",");
  const highEur = PLUS_PRICE.highEur.toFixed(2).replace(".", ",");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12 sm:pt-16">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
        DeGeldHeld Plus
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
        Eén abonnement dat élke maand jouw geld zoekt
      </h1>
      <p className="mt-3 text-lg text-slate-700">
        We blijven kijken — niet alleen één keer bij een upload. Vaste lasten,
        toeslagen + gemeente-regelingen, en op tijd seinen voor contract-einde of
        prijsstijging. Klant betaalt → <strong>100% aligned</strong> (nooit providergeld).
      </p>

      <section
        data-testid="plus-pillars"
        aria-labelledby="plus-pillars-heading"
        className="mt-10 space-y-4"
      >
        <h2 id="plus-pillars-heading" className="sr-only">
          Wat zit erin
        </h2>
        {PLUS_PILLARS.map((p) => (
          <article
            key={p.id}
            data-testid={`plus-pillar-${p.id}`}
            className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-slate-900">{p.title}</h3>
            <p className="mt-1 text-sm text-slate-700">{p.body}</p>
          </article>
        ))}
      </section>

      <section
        data-testid="plus-price"
        className="mt-10 rounded-2xl bg-brand-50 p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          Prijs
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          Vanaf € {lowEur}/maand
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Indicatief: € {lowEur}–€ {highEur} per maand, opzegbaar elk moment.
          De her-check toeslagen + gemeente blijft altijd <strong>gratis</strong> via{" "}
          <Link href="/geld-check" className="underline">
            /geld-check
          </Link>{" "}
          — Plus voegt automatisch her-scannen + alerts toe.
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Hou me op de hoogte</h2>
        <p className="mt-1 text-sm text-slate-700">
          Plus opent binnenkort — we ronden de laatste setup-stappen af zodat
          de maandelijkse her-scan + alerts soepel lopen. Wil je een seintje
          zodra het zover is?
        </p>
        <a
          href="mailto:hallo@degeldheld.com?subject=DeGeldHeld%20Plus%20%E2%80%94%20wachtlijst"
          data-testid="plus-waitlist"
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Mail me als Plus open gaat →
        </a>
        <p className="mt-2 text-xs text-slate-500">
          Geen DigiD nodig · Niet bespaard? Geen factuur · Opzegbaar elk moment
        </p>
      </section>

      <div className="mt-10 text-center text-sm text-slate-500">
        <Link href="/" className="underline">
          ← Terug
        </Link>
      </div>
    </main>
  );
}
