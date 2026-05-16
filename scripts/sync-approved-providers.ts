#!/usr/bin/env node
/**
 * Print TypeScript stubs for all APPROVED ProviderCandidate rows so they can
 * be pasted into lib/providers.ts manually.
 *
 * Usage: npx tsx scripts/sync-approved-providers.ts
 *
 * Pragmatic: candidates are still in the DB after approval; the human curator
 * decides category/network/aliases and pastes the final entry into the static
 * registry. Once pasted, mark the candidate REJECTED to remove it from the
 * pending list (or just leave it — the @@unique key prevents duplicates).
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const approved = await prisma.providerCandidate.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ country: "asc" }, { name: "asc" }],
  });
  if (approved.length === 0) {
    console.log("// No APPROVED candidates pending.");
    await prisma.$disconnect();
    return;
  }

  console.log(`// ${approved.length} approved candidate(s) — paste into lib/providers.ts`);
  for (const c of approved) {
    let r: Record<string, string> = {};
    try {
      r = JSON.parse(c.retentionJson);
    } catch {
      r = {};
    }
    const retention = Object.keys(r).length
      ? `, retention: ${JSON.stringify(r)}`
      : "";
    // We don't know the category from discovery — default to OVERIG so a human reviews.
    console.log(
      `P({ canonical: ${JSON.stringify(c.name)}, names: [${JSON.stringify(c.name.toLowerCase())}], category: "OVERIG", country: ${JSON.stringify(c.country)}${retention} }),`,
    );
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
