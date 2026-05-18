/**
 * scripts/db-backup-verify.ts — v14 DEEL 5
 *
 * Print row-counts per critical table so the user can spot when a
 * restore drill misplaced data. Doesn't touch the DB beyond
 * SELECT count queries.
 *
 * Run:
 *   DATABASE_URL=postgresql://... npx tsx scripts/db-backup-verify.ts
 *
 * Hard guard: the script refuses to run without DATABASE_URL — no
 * accidental hits against an empty default.
 */
import { prisma } from "@/lib/db";

type Row = { table: string; count: number; expected: "any" | "≥1" };

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing — refusing to run.");
    process.exit(2);
  }

  const rows: Row[] = [
    { table: "User", count: await prisma.user.count(), expected: "any" },
    { table: "Bill", count: await prisma.bill.count(), expected: "any" },
    { table: "Negotiation", count: await prisma.negotiation.count(), expected: "any" },
    { table: "NegotiationRound", count: await prisma.negotiationRound.count(), expected: "any" },
    { table: "OutcomeProof", count: await prisma.outcomeProof.count(), expected: "any" },
    { table: "FraudFlag", count: await prisma.fraudFlag.count(), expected: "any" },
    { table: "Payment", count: await prisma.payment.count(), expected: "any" },
    { table: "WaitlistEntry", count: await prisma.waitlistEntry.count(), expected: "any" },
    { table: "Referral", count: await prisma.referral.count(), expected: "any" },
    { table: "CronRunLog", count: await prisma.cronRunLog.count(), expected: "any" },
  ];

  const target = process.env.DATABASE_URL.split("@")[1]?.split("/")[0] ?? "(unknown)";
  console.log(`\n=== DB count snapshot — ${target} ===\n`);
  for (const r of rows) {
    console.log(`  ${r.table.padEnd(20)} ${String(r.count).padStart(8)}`);
  }
  console.log();

  // Sanity gate: the User table should never be empty in prod.
  if (rows[0].count === 0) {
    console.warn(
      "WARNING: User count is 0. If this is prod, the restore may have wiped data.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
