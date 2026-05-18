/**
 * v10 categories-v2 backfill — populate Bill.subType voor bestaande records.
 *
 * Loopt alle Bills af waar `subType` nog NULL is. Zet een sub-type
 * op basis van de legacy `category` enum + provider-naam-heuristiek
 * (zie inferSubType in lib/categories.ts).
 *
 * Idempotent: alleen records met subType == null worden geüpdatet.
 *
 * Run:
 *   npx tsx scripts/migrate-categories-v2.ts            # dry-run (default)
 *   npx tsx scripts/migrate-categories-v2.ts --apply    # commit changes
 */

import { prisma } from "@/lib/db";
import { inferSubType } from "@/lib/categories";
import type { BillCategory } from "@prisma/client";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`[migrate-categories-v2] mode = ${apply ? "APPLY" : "dry-run"}`);

  const bills = await prisma.bill.findMany({
    where: { subType: null },
    select: { id: true, category: true, provider: true },
  });
  console.log(`Found ${bills.length} bills without subType.`);

  let setCount = 0;
  let skipCount = 0;
  for (const b of bills) {
    const sub = inferSubType(b.category as BillCategory, b.provider);
    if (!sub) {
      skipCount++;
      continue;
    }
    if (apply) {
      await prisma.bill.update({ where: { id: b.id }, data: { subType: sub } });
    }
    setCount++;
  }
  console.log(
    `[migrate-categories-v2] would set subType on ${setCount} bills, skip ${skipCount} (no rule).`,
  );
  if (!apply) console.log("Dry run only — pass --apply to persist.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
