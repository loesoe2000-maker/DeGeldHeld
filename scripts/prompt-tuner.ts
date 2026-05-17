/**
 * scripts/prompt-tuner.ts
 *
 * Nightly analytics over de afgelopen 30 dagen mail-feedback:
 *   - per strategy: thumbs-up%, mail-used%, success%
 *   - per provider: idem
 *   - per category: idem
 *
 * Output: print rapport. GEEN auto-aanpassing van prompts — te risky.
 * Owner besluit handmatig op basis van het rapport.
 *
 * Schedule via Vercel Cron: `0 3 * * *` (3am UTC).
 */

export {};

import { prisma } from "../lib/db";

type Row = { name: string; total: number; up: number; down: number; used: number; responded: number; success: number };

function pct(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

function bucket(map: Map<string, Row>, key: string, n: {
  userRating: number | null;
  mailUsed: boolean;
  providerResponded: boolean | null;
  state: string;
}) {
  const row = map.get(key) ?? { name: key, total: 0, up: 0, down: 0, used: 0, responded: 0, success: 0 };
  row.total++;
  if (n.userRating === 1) row.up++;
  if (n.userRating === -1) row.down++;
  if (n.mailUsed) row.used++;
  if (n.providerResponded === true) row.responded++;
  if (n.state === "SUCCESS" || n.state === "BILLED" || n.state === "ACCEPTED") row.success++;
  map.set(key, row);
}

function printSection(title: string, rows: Row[]) {
  console.log(`\n## ${title}`);
  const sorted = rows.sort((a, b) => b.total - a.total).slice(0, 12);
  console.log("name".padEnd(28) + " n   👍   👎   used  resp  succ");
  for (const r of sorted) {
    console.log(
      r.name.padEnd(28) +
        ` ${String(r.total).padEnd(3)} ${pct(r.up, r.total).padEnd(4)} ${pct(r.down, r.total).padEnd(4)} ` +
        ` ${pct(r.used, r.total).padEnd(4)} ${pct(r.responded, r.total).padEnd(4)} ${pct(r.success, r.total)}`
    );
  }
}

async function main() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const negs = await prisma.negotiation.findMany({
    where: { createdAt: { gte: cutoff }, emailSentAt: { not: null } },
    select: {
      userRating: true,
      mailUsed: true,
      providerResponded: true,
      state: true,
      strategy: true,
      bill: { select: { provider: true, category: true } },
    },
  });

  console.log(`# prompt-tuner — last 30d (${negs.length} negotiations)`);

  const byStrategy = new Map<string, Row>();
  const byProvider = new Map<string, Row>();
  const byCategory = new Map<string, Row>();
  for (const n of negs) {
    bucket(byStrategy, n.strategy ?? "ONBEKEND", n);
    bucket(byProvider, n.bill.provider, n);
    bucket(byCategory, n.bill.category, n);
  }
  printSection("strategy", Array.from(byStrategy.values()));
  printSection("provider", Array.from(byProvider.values()));
  printSection("category", Array.from(byCategory.values()));

  // Highlight: lowest-rated strategies (>5 cases)
  const worst = Array.from(byStrategy.values())
    .filter((r) => r.total >= 5 && (r.up + r.down) > 0)
    .sort((a, b) => (a.up - a.down) / a.total - (b.up - b.down) / b.total)
    .slice(0, 3);
  if (worst.length > 0) {
    console.log("\n## ⚠ Lowest-rated strategies (review prompt)");
    for (const r of worst) console.log(`  ${r.name}: ${r.up}/${r.total} 👍, ${r.down}/${r.total} 👎`);
  }
}

void main().finally(() => prisma.$disconnect());
