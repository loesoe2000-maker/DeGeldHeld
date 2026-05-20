/**
 * lib/savings-timeline.ts — pure helpers for the dashboard
 * "bespaard over tijd" section. No DB / React here so it's unit-testable.
 */
import { PRIMARY_META, type PrimaryCategory } from "@/lib/categories";

export type SavedPoint = { at: Date; cents: number };

export type TimelineBucket = { label: string; monthKey: string; cumulativeCents: number };

const NL_MONTHS = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

/**
 * Cumulative saved amount per calendar month, oldest → newest. Empty months
 * between data points are omitted (we only chart months with a win).
 */
export function cumulativeByMonth(points: SavedPoint[]): TimelineBucket[] {
  const byMonth = new Map<string, number>();
  for (const p of points) {
    if (!p.cents) continue;
    const key = `${p.at.getUTCFullYear()}-${String(p.at.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.cents);
  }
  const keys = [...byMonth.keys()].sort();
  let running = 0;
  return keys.map((key) => {
    running += byMonth.get(key) ?? 0;
    const [y, m] = key.split("-");
    return {
      monthKey: key,
      label: `${NL_MONTHS[Number(m) - 1]} '${y.slice(2)}`,
      cumulativeCents: running,
    };
  });
}

// Rough typical *annual* household savings per category — used only for the
// motivational milestone copy ("huishoudens als jij besparen €Y meer").
const TYPICAL_ANNUAL_SAVINGS_EUR: Partial<Record<PrimaryCategory, number>> = {
  ENERGIE: 250,
  VERZEKERING: 180,
  TELECOM: 120,
  WONEN: 300,
  FINANCIEN: 60,
  ABONNEMENTEN: 90,
};

export type Milestone = { savedEur: number; cta: string | null };

/**
 * Milestone copy: where the user stands + how much more a household like
 * theirs typically saves on a category they haven't covered yet.
 */
export function milestoneCopy(totalCents: number, missing: PrimaryCategory | null): Milestone {
  const savedEur = Math.round(totalCents / 100);
  if (!missing) return { savedEur, cta: null };
  const extra = TYPICAL_ANNUAL_SAVINGS_EUR[missing] ?? 100;
  const label = PRIMARY_META[missing].label.toLowerCase();
  return {
    savedEur,
    cta: `Huishoudens als jij besparen gemiddeld nog eens ~€${extra}/jaar op hun ${label}.`,
  };
}
