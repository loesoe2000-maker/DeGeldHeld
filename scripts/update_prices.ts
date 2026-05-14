/**
 * Manuele markt-prijs refresh.
 * Toekomstige uitbreiding: scrape providers, hier nu placeholder.
 *
 * Usage: pnpm update-prices [--provider=ZIGGO --plan="..." --price=49.95]
 */

import { prisma } from "../lib/db";
import { parseEurInput } from "../lib/format";

type Args = { provider?: string; plan?: string; price?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const a of argv.slice(2)) {
    const m = /^--([a-z]+)=(.+)$/i.exec(a);
    if (m) (args as Record<string, string>)[m[1].toLowerCase()] = m[2];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.provider || !args.plan || !args.price) {
    console.error("Usage: pnpm update-prices --provider=NAME --plan=NAME --price=15.70");
    process.exit(2);
  }
  const cents = parseEurInput(args.price);
  if (cents == null) {
    console.error(`Invalid price: ${args.price}`);
    process.exit(2);
  }
  const provider = await prisma.marketProvider.findUnique({ where: { name: args.provider } });
  if (!provider) {
    console.error(`Provider niet gevonden: ${args.provider}`);
    process.exit(2);
  }
  const updated = await prisma.marketPlan.updateMany({
    where: { providerId: provider.id, name: args.plan },
    data: { priceCents: cents },
  });
  console.log(`Updated ${updated.count} plan(s) — ${args.provider} / ${args.plan} → ${args.price}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
