/**
 * Seed market_provider + market_plan vanuit lib/market_db.ts.
 * Run: pnpm seed
 */

import { prisma } from "../lib/db";
import { MARKET_PLANS, uniqueProviders } from "../lib/market_db";
import { findProvider } from "../lib/providers";

async function main() {
  console.log(`Seeding ${uniqueProviders().length} providers, ${MARKET_PLANS.length} plans…`);

  for (const providerName of uniqueProviders()) {
    const meta = findProvider(providerName);
    const cat = meta?.category ?? "OVERIG";
    const cheapest = MARKET_PLANS.filter((p) => p.provider === providerName).reduce(
      (a, b) => (a.priceCents <= b.priceCents ? a : b),
    );
    await prisma.marketProvider.upsert({
      where: { name: providerName },
      update: { category: cat, basePriceCents: cheapest.priceCents },
      create: { name: providerName, category: cat, basePriceCents: cheapest.priceCents },
    });
  }

  // Reset and re-insert plans (idempotent on re-run).
  await prisma.marketPlan.deleteMany({});
  for (const p of MARKET_PLANS) {
    const provider = await prisma.marketProvider.findUnique({ where: { name: p.provider } });
    if (!provider) continue;
    await prisma.marketPlan.create({
      data: {
        providerId: provider.id,
        name: p.name,
        category: p.category,
        priceCents: p.priceCents,
        features: p.features,
      },
    });
  }

  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
