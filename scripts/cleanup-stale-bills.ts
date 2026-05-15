/**
 * scripts/cleanup-stale-bills.ts
 *
 * Verwijder mislukte Bill uploads waar OCR geen bruikbare data extracteerde:
 *   provider IN ("Onbekend", "") AND amountCents = 0 AND createdAt > 24u geleden
 *
 * Negotiation cascade is via Prisma schema (onDelete: Cascade) al geregeld,
 * dus Bill delete neemt eventuele hangende negotiations mee.
 *
 * Idempotent: bij herhaaldelijk draaien verwijdert het niets meer.
 *
 * Run:
 *   npx tsx scripts/cleanup-stale-bills.ts                 # gebruikt .env DATABASE_URL
 *   DATABASE_URL=... npx tsx scripts/cleanup-stale-bills.ts # expliciet
 */

import { prisma } from "../lib/db";

export async function cleanupStaleBills(opts: { now?: Date } = {}): Promise<{
  deleted: number;
  matched: number;
}> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24u geleden

  // Match: provider lege/Onbekend AND amount 0 AND ouder dan 24u
  const where = {
    AND: [
      { OR: [{ provider: "Onbekend" }, { provider: "" }] },
      { amountCents: 0 },
      { createdAt: { lt: cutoff } },
    ],
  };

  const matched = await prisma.bill.count({ where });
  if (matched === 0) {
    return { deleted: 0, matched: 0 };
  }

  const result = await prisma.bill.deleteMany({ where });
  return { deleted: result.count, matched };
}

async function main() {
  const start = Date.now();
  console.log("[cleanup-stale-bills] start", new Date().toISOString());
  try {
    const { deleted, matched } = await cleanupStaleBills();
    console.log(
      `[cleanup-stale-bills] matched=${matched} deleted=${deleted} ` +
        `duration=${Date.now() - start}ms`,
    );
    process.exit(0);
  } catch (e) {
    console.error("[cleanup-stale-bills] failed:", e);
    process.exit(1);
  }
}

// Run wanneer direct uitgevoerd (niet bij import voor tests)
if (require.main === module) {
  main();
}
