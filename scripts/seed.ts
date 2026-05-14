/**
 * Idempotent seed van market_provider + market_plan vanuit lib/market_db.ts.
 * Run: npm run seed   (of: tsx scripts/seed.ts)
 *
 * Safe to re-run: providers worden upserted (op naam), plans worden
 * upserted op (providerId + name + category) tuple.
 */

import { prisma } from "../lib/db";
import { MARKET_PLANS, uniqueProviders } from "../lib/market_db";
import { findProvider } from "../lib/providers";

export async function seedMarket() {
  const providers = uniqueProviders();
  let providersInserted = 0;
  let providersUpdated = 0;

  for (const providerName of providers) {
    const meta = findProvider(providerName);
    const cat = meta?.category ?? "OVERIG";
    const planList = MARKET_PLANS.filter((p) => p.provider === providerName);
    const cheapest = planList.reduce(
      (a, b) => (a.priceCents <= b.priceCents ? a : b),
      planList[0],
    );
    const existing = await prisma.marketProvider.findUnique({ where: { name: providerName } });
    if (existing) providersUpdated += 1;
    else providersInserted += 1;
    await prisma.marketProvider.upsert({
      where: { name: providerName },
      update: { category: cat, basePriceCents: cheapest.priceCents },
      create: { name: providerName, category: cat, basePriceCents: cheapest.priceCents },
    });
  }

  // Plans: use deleteMany scoped per provider + recreate for clean state.
  let plansInserted = 0;
  for (const providerName of providers) {
    const provider = await prisma.marketProvider.findUnique({ where: { name: providerName } });
    if (!provider) continue;
    await prisma.marketPlan.deleteMany({ where: { providerId: provider.id } });
    const planList = MARKET_PLANS.filter((p) => p.provider === providerName);
    for (const p of planList) {
      await prisma.marketPlan.create({
        data: {
          providerId: provider.id,
          name: p.name,
          category: p.category,
          priceCents: p.priceCents,
          features: p.features,
        },
      });
      plansInserted += 1;
    }
  }

  return { providersInserted, providersUpdated, plansInserted, totalProviders: providers.length };
}

async function main() {
  console.log(`Seeding ${uniqueProviders().length} providers, ${MARKET_PLANS.length} plans…`);
  const stats = await seedMarket();
  console.log(`Done: ${stats.providersInserted} new providers, ${stats.providersUpdated} updated, ${stats.plansInserted} plans inserted.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
