/**
 * SEO landing pages — Single dynamic root segment to satisfy Next.js App
 * Router. Next 14 does NOT match a dynamic param embedded mid-segment
 * (`onderhandelen-met-[provider]` folder names), so we put the entire
 * slug (incl. prefix/suffix) into one bracketed segment and dispatch
 * inside.
 *
 *  - "onderhandelen-met-<provider>" → ProviderSeoPage
 *  - "<category>-besparen"          → CategorySeoPage
 *  - anything else                  → notFound() (dynamicParams = false)
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  SEO_PROVIDERS,
  SEO_CATEGORIES,
  findCategorySlug,
  findProviderSlug,
} from "@/lib/seo-data";
import { primaryFromLegacy } from "@/lib/categories";
import { infoFor } from "@/lib/category-info";
import CategoryInfoSection from "@/components/CategoryInfoSection";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const provider = SEO_PROVIDERS.map((p) => ({ seoSlug: `onderhandelen-met-${p.slug}` }));
  const cat = SEO_CATEGORIES.map((c) => ({ seoSlug: `${c.slug}-besparen` }));
  return [...provider, ...cat];
}

function parseSlug(slug: string):
  | { kind: "provider"; record: NonNullable<ReturnType<typeof findProviderSlug>> }
  | { kind: "category"; record: NonNullable<ReturnType<typeof findCategorySlug>> }
  | null {
  const providerMatch = /^onderhandelen-met-(.+)$/.exec(slug);
  if (providerMatch) {
    const r = findProviderSlug(providerMatch[1]);
    return r ? { kind: "provider", record: r } : null;
  }
  const catMatch = /^(.+)-besparen$/.exec(slug);
  if (catMatch) {
    const r = findCategorySlug(catMatch[1]);
    return r ? { kind: "category", record: r } : null;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ seoSlug: string }> }) {
  const { seoSlug } = await params;
  const parsed = parseSlug(seoSlug);
  if (!parsed) return { title: "Pagina niet gevonden — DeGeldHeld" };
  if (parsed.kind === "provider") {
    const p = parsed.record;
    return {
      title: `Onderhandelen met ${p.name} — gemiddeld €${p.averageOverpayEurMonth}/mnd besparen | DeGeldHeld`,
      description: `Hoe verlaag je je ${p.name}-rekening? Stappenplan, retentie-hoek en concrete e-mail-template via DeGeldHeld.`,
      openGraph: {
        title: `${p.name} korting onderhandelen via DeGeldHeld`,
        description: `Gemiddeld €${p.averageOverpayEurMonth}/mnd besparen bij ${p.name}.`,
      },
    };
  }
  const c = parsed.record;
  return {
    title: `Besparen op ${c.label} — gemiddeld €${c.averageYearlySaving}/jaar | DeGeldHeld`,
    description: `Hoe verlaag je je ${c.label}-kosten? Markt-overzicht, stappenplan en AI-mail-template via DeGeldHeld.`,
    openGraph: {
      title: `${c.label} besparen via DeGeldHeld`,
      description: `Gemiddeld €${c.averageYearlySaving} per jaar besparen op ${c.label}.`,
    },
  };
}

export default async function SeoLandingPage({
  params,
}: {
  params: Promise<{ seoSlug: string }>;
}) {
  const { seoSlug } = await params;
  const parsed = parseSlug(seoSlug);
  if (!parsed) notFound();

  if (parsed.kind === "provider") return <ProviderPage record={parsed.record} />;
  return <CategoryPage record={parsed.record} />;
}

function ProviderPage({ record: p }: { record: NonNullable<ReturnType<typeof findProviderSlug>> }) {
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

const intros: Record<string, string> = {
  telecom: `Telecom is in Nederland een verzadigde markt. KPN, Vodafone, Odido en Ziggo bezitten samen ~85% van de aansluitingen, maar er zijn tientallen MVNO's die op hetzelfde netwerk dezelfde kwaliteit leveren voor 30-50% minder. Het probleem: klanten verlengen vaak automatisch en de retentie-korting wordt alleen actief uitgereikt aan wie er om vraagt. Een gemiddeld huishouden betaalt €25-40/mnd voor één telefoon-abonnement, terwijl een MVNO op KPN-netwerk hetzelfde voor €12-18 levert. Met een goed-geformuleerde retentie-mail haal je vrijwel altijd een korting van 15-25% binnen.`,
  energie: `De Nederlandse energiemarkt veranderde fundamenteel na 2022. Variabele contracten kunnen elk kwartaal omhoog, vaste contracten zijn weer terug maar dragen vaak verborgen vastrecht-componenten. Eneco, Vattenfall en Essent dekken samen ~70% van NL, maar Vandebron, Frank Energie, Pure Energie en Greenchoice bieden vaak €30-50/maand lager. Het venster om over te stappen is meestal 1-2 maanden voor het einde van je termijn. Wie de moeite neemt te onderhandelen of over te stappen bespaart €400-600 per jaar.`,
  verzekering: `Autoverzekeringen, inboedel, aansprakelijkheid: de Nederlandse markt heeft ~30 actieve aanbieders maar slechts ~10 prijsbepalers (Achmea, ASR, NN, Allianz). De rest is wit-label of regionaal. Het slimme onderhandelen begint bij je dekking: heb je écht casco nodig op een 12-jaar oude auto? Een eigen risico van €150 vs €500 scheelt vaak 20% premie. Voor de meeste huishoudens ligt €150-200 per jaar op tafel.`,
  hypotheek: `Hypotheekrentes daalden tot 2023, stegen tot ~4,5% in 2024, en zakken nu langzaam terug. Veel klanten hebben tussen 2020-2022 vast gezet op 4-5% en kunnen nu oversluiten naar 3,8-4,1%. Vergeet niet: oversluitkosten zijn meestal €2.500-4.000 (advies, taxatie, notaris, eventueel boeterente). Het loont pas als je rente-delta >0,8% is én je nog >5 jaar te gaan hebt. Voor de gemiddelde NL-huis met €250k-€350k restschuld levert oversluiten €80-120 per maand op.`,
};

function CategoryPage({ record: c }: { record: NonNullable<ReturnType<typeof findCategorySlug>> }) {
  const providers = SEO_PROVIDERS.filter((p) => p.category === c.category);
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Besparen op ${c.label}`,
    author: { "@type": "Organization", name: "DeGeldHeld" },
    publisher: { "@type": "Organization", name: "DeGeldHeld" },
  };
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <p className="text-sm text-slate-500">DeGeldHeld → {c.label}</p>
      <h1 className="mt-2 text-4xl font-bold text-slate-900">Besparen op {c.label}</h1>

      <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">Gemiddeld jaarvoordeel</div>
        <div className="mt-1 text-3xl font-bold text-emerald-700">€{c.averageYearlySaving}/jaar</div>
        <p className="mt-2 text-sm text-emerald-900">
          Op basis van geslaagde onderhandelingen via DeGeldHeld in {c.label}.
        </p>
      </section>

      <section className="mt-8 prose prose-slate max-w-none">
        <p>{intros[c.slug] ?? ""}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-slate-900">5 stappen om {c.label} kosten te verlagen</h2>
        <ol className="mt-3 space-y-2 text-slate-700">
          <li><strong>1. Verzamel je laatste factuur of polis</strong></li>
          <li><strong>2. Identificeer 3 goedkopere alternatieven</strong> (zelfde dekking/data/kwaliteit)</li>
          <li><strong>3. Schrijf naar retentie/behoud — niet algemene klantenservice</strong></li>
          <li><strong>4. Geef een concrete deadline van 14 werkdagen</strong></li>
          <li><strong>5. Wees bereid op te stappen indien geen voorstel</strong></li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-slate-900">Top {c.label}-providers</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <li key={p.slug} className="rounded-xl border border-slate-200 bg-white p-4">
              <Link href={`/onderhandelen-met-${p.slug}`} className="text-lg font-semibold text-brand-700 underline">{p.name}</Link>
              <p className="mt-1 text-sm text-slate-600">{p.intro}</p>
            </li>
          ))}
        </ul>
      </section>

      <CategoryInfoSection
        primary={primaryFromLegacy(c.category)}
        info={infoFor(primaryFromLegacy(c.category))}
      />

      <section className="mt-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
        <h2 className="text-xl font-bold">Doe 't met DeGeldHeld</h2>
        <p className="mt-1 text-sm text-brand-50">Upload je {c.label}-factuur. AI schrijft de mail. Jij verstuurt. Eerste keer gratis.</p>
        <Link href="/onderhandel" className="mt-4 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 hover:bg-slate-100">
          Start gratis →
        </Link>
      </section>
    </main>
  );
}
