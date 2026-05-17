/**
 * lib/psd2/detect-bills.ts — recurring-debit detector.
 *
 * Input: array of TinkTransaction.
 * Output: list of {counterpartyName, monthlyCents, category, lastSeen}.
 *
 * Heuristic:
 *   - Outgoing transactions only (amount.value < 0)
 *   - Group by normalized counterparty name
 *   - Within a group: bucket amounts within ±5% of each other (rolling)
 *   - If a bucket has ≥ 2 occurrences within ~31 days apart on average,
 *     it's recurring → emit.
 *   - Category: best fuzzy match against provider-registry; fall back OVERIG.
 */

import type { TinkTransaction } from "@/lib/psd2/tink";
import { findProvider, type Category } from "@/lib/providers";

export type DetectedRecurring = {
  counterpartyName: string;
  monthlyCents: number;
  category: Category;
  lastSeenAt: Date;
  occurrences: number;
};

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCounterparty(t: TinkTransaction): string {
  const cp = t.counterParties;
  return (
    cp?.payee?.name ??
    cp?.payer?.name ??
    t.descriptions.display ??
    t.descriptions.original ??
    "unknown"
  );
}

export function detectRecurring(transactions: TinkTransaction[]): DetectedRecurring[] {
  // Only debits (negative amounts)
  const debits = transactions.filter((t) => t.amount.value < 0);

  // Group by normalized counterparty
  const groups = new Map<string, TinkTransaction[]>();
  for (const t of debits) {
    const key = normalizeName(extractCounterparty(t));
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const out: DetectedRecurring[] = [];
  for (const [name, txns] of groups) {
    if (txns.length < 2) continue;
    // Sort by date ascending
    txns.sort((a, b) => new Date(a.bookedDateTime).getTime() - new Date(b.bookedDateTime).getTime());

    // Bucket amounts within 5% of each other; pick the largest bucket
    const buckets: { amounts: number[]; txns: TinkTransaction[] }[] = [];
    for (const t of txns) {
      const amt = Math.abs(t.amount.value);
      let placed = false;
      for (const b of buckets) {
        const avg = b.amounts.reduce((a, n) => a + n, 0) / b.amounts.length;
        if (Math.abs(amt - avg) / avg <= 0.05) {
          b.amounts.push(amt);
          b.txns.push(t);
          placed = true;
          break;
        }
      }
      if (!placed) buckets.push({ amounts: [amt], txns: [t] });
    }

    const biggest = buckets.sort((a, b) => b.txns.length - a.txns.length)[0];
    if (!biggest || biggest.txns.length < 2) continue;

    const avgAmt = biggest.amounts.reduce((a, n) => a + n, 0) / biggest.amounts.length;
    const monthlyCents = Math.round(avgAmt * 100);

    // Average gap days — should be roughly 28-32 for monthly, but accept up to 45
    const sorted = biggest.txns.map((t) => new Date(t.bookedDateTime).getTime()).sort((a, b) => a - b);
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) totalGap += sorted[i] - sorted[i - 1];
    const avgGapDays = totalGap / (sorted.length - 1) / (1000 * 60 * 60 * 24);
    if (avgGapDays < 25 || avgGapDays > 40) continue;

    const last = biggest.txns[biggest.txns.length - 1];
    const matched = findProvider(name);

    out.push({
      counterpartyName: matched?.canonical ?? extractCounterparty(last),
      monthlyCents,
      category: matched?.category ?? "OVERIG",
      lastSeenAt: new Date(last.bookedDateTime),
      occurrences: biggest.txns.length,
    });
  }

  return out;
}
