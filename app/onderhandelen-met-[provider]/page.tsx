import { notFound } from "next/navigation";
import Link from "next/link";
import { SEO_PROVIDERS, findProviderSlug } from "@/lib/seo-data";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SEO_PROVIDERS.map((p) => ({ provider: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = findProviderSlug(provider);
  if (!p) return { title: "Provider niet gevonden — DeGeldHeld" };
  return {
    title: `Onderhandelen met ${p.name} — gemiddeld €${p.averageOverpayEurMonth}/mnd besparen | DeGeldHeld`,
    description: `Hoe verlaag je je ${p.name}-rekening? Stappenplan, retentie-hoek en concrete e-mail-template via DeGeldHeld.`,
    openGraph: {
      title: `${p.name} korting onderhandelen via DeGeldHeld`,
      description: `Gemiddeld €${p.averageOverpayEurMonth}/mnd besparen bij ${p.name}. Stappenplan + AI-mail.`,
    },
  };
}

export default async function ProviderSeoPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = findProviderSlug(provider);
  if (!p) notFound();

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Onderhandelen met ${p.name}`,
    description: p.intro,
    author: { "@type": "Organization", name: "DeGeldHeld" },
    publisher: { "@type": "Organization", name: "DeGeldHeld" },
  };

  const others = SEO_PROVIDERS.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, 3);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <p className="text-sm text-slate-500">DeGeldHeld → {p.category.toLowerCase()} → {p.name}</p>
      <h1 className="mt-2 text-4xl font-bold text-slate-900">Onderhandelen met {p.name}</h1>
      <p className="mt-3 text-lg text-slate-600">{p.intro}</p>

      <section className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-lg font-semibold text-emerald-900">Wat kan je besparen?</h2>
        <p className="mt-2 text-emerald-900">
          De gemiddelde {p.name}-klant betaalt <strong>€{p.averageOverpayEurMonth}/maand</strong> boven markt-mediaan. Dat is
          <strong> €{p.averageOverpayEurMonth * 12}/jaar</strong> aan ruimte voor onderhandeling.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-slate-900">Hoe werkt onderhandelen met {p.name}?</h2>
        <p className="mt-2 text-slate-700">
          {p.name} heeft, net als bijna alle Nederlandse providers, een interne <em>retentie-afdeling</em>.
          Hun werk is om klanten die dreigen op te zeggen vast te houden — meestal met een korting waar je niet
          om hoeft te vragen via de gewone klantenservice. De truc: weet wat je vraagt, ken een goedkoper
          alternatief, en zet een concrete deadline.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-slate-900">5 stappen om {p.name} korting te krijgen</h2>
        <ol className="mt-3 space-y-2 text-slate-700">
          <li><strong>1. Verzamel je laatste factuur</strong> — bedrag, pakket, klantnummer.</li>
          <li><strong>2. Vergelijk met markt</strong> — check 2-3 concurrenten met vergelijkbaar pakket.</li>
          <li><strong>3. Schrijf naar retentie</strong> — niet de algemene klantenservice maar specifiek "Behoud" of "Retentie".</li>
          <li><strong>4. Zet een deadline</strong> — 14 werkdagen is standaard, daarna escaleer of stap over.</li>
          <li><strong>5. Wees bereid op te stappen</strong> — anders verlies je je hefboom.</li>
        </ol>
      </section>

      <section className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-brand-900">DeGeldHeld doet dit voor je</h2>
        <p className="mt-2 text-brand-900">
          Upload je {p.name}-rekening, en wij genereren een retentie-mail met {p.retentionAngle}.
          Eerste onderhandeling gratis, daarna €4,99 per bill.
        </p>
        <Link href="/onderhandel" className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">
          Start gratis →
        </Link>
      </section>

      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-slate-900">Andere {p.category.toLowerCase()}-providers</h2>
          <ul className="mt-3 space-y-1 text-slate-700">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/onderhandelen-met-${o.slug}`} className="text-brand-700 underline">{o.name}</Link>
                {" "}— €{o.averageOverpayEurMonth}/mnd gemiddelde overpay
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 text-center">
        <Link href="/demo" className="text-sm text-slate-600 underline">Demo zonder upload bekijken →</Link>
      </div>
    </main>
  );
}
