import { notFound } from "next/navigation";
import Link from "next/link";
import { SEO_CATEGORIES, SEO_PROVIDERS, findCategorySlug } from "@/lib/seo-data";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SEO_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = findCategorySlug(category);
  if (!c) return { title: "Categorie niet gevonden — DeGeldHeld" };
  return {
    title: `Besparen op ${c.label} — gemiddeld €${c.averageYearlySaving}/jaar | DeGeldHeld`,
    description: `Hoe verlaag je je ${c.label}-kosten? Markt-overzicht, stappenplan en AI-mail-template via DeGeldHeld.`,
    openGraph: {
      title: `${c.label} besparen via DeGeldHeld`,
      description: `Gemiddeld €${c.averageYearlySaving} per jaar besparen op ${c.label}.`,
    },
  };
}

export default async function CategorySeoPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = findCategorySlug(category);
  if (!c) notFound();

  const providers = SEO_PROVIDERS.filter((p) => p.category === c.category);
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Besparen op ${c.label}`,
    author: { "@type": "Organization", name: "DeGeldHeld" },
    publisher: { "@type": "Organization", name: "DeGeldHeld" },
  };

  // Category-specific intro paragraph (~250-400 words for SEO depth)
  const intros: Record<string, string> = {
    telecom: `Telecom is in Nederland een verzadigde markt. KPN, Vodafone, Odido en Ziggo bezitten samen ~85% van de aansluitingen, maar er zijn tientallen MVNO's die op hetzelfde netwerk dezelfde kwaliteit leveren voor 30-50% minder. Het probleem: klanten verlengen vaak automatisch en de retentie-korting wordt alleen actief uitgereikt aan wie er om vraagt. Een gemiddeld huishouden betaalt €25-40/mnd voor één telefoon-abonnement, terwijl een MVNO op KPN-netwerk hetzelfde voor €12-18 levert. Met een goed-geformuleerde retentie-mail haal je vrijwel altijd een korting van 15-25% binnen.`,
    energie: `De Nederlandse energiemarkt veranderde fundamenteel na 2022. Variabele contracten kunnen elk kwartaal omhoog, vaste contracten zijn weer terug maar dragen vaak verborgen vastrecht-componenten. Eneco, Vattenfall en Essent dekken samen ~70% van NL, maar Vandebron, Frank Energie, Pure Energie en Greenchoice bieden vaak €30-50/maand lager. Het venster om over te stappen is meestal 1-2 maanden voor het einde van je termijn. Wie de moeite neemt te onderhandelen of over te stappen bespaart €400-600 per jaar.`,
    verzekering: `Autoverzekeringen, inboedel, aansprakelijkheid: de Nederlandse markt heeft ~30 actieve aanbieders maar slechts ~10 prijsbepalers (Achmea, ASR, NN, Allianz). De rest is wit-label of regionaal. Het slimme onderhandelen begint bij je dekking: heb je écht casco nodig op een 12-jaar oude auto? Een eigen risico van €150 vs €500 scheelt vaak 20% premie. Voor de meeste huishoudens ligt €150-200 per jaar op tafel.`,
    hypotheek: `Hypotheekrentes daalden tot 2023, stegen tot ~4,5% in 2024, en zakken nu langzaam terug. Veel klanten hebben tussen 2020-2022 vast gezet op 4-5% en kunnen nu oversluiten naar 3,8-4,1%. Vergeet niet: oversluitkosten zijn meestal €2.500-4.000 (advies, taxatie, notaris, eventueel boeterente). Het loont pas als je rente-delta >0,8% is én je nog >5 jaar te gaan hebt. Voor de gemiddelde NL-huis met €250k-€350k restschuld levert oversluiten €80-120 per maand op.`,
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
