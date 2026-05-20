/**
 * lib/category-gap.ts — which primary categories does a user NOT have yet?
 *
 * Powers the multi-category nudge (v21 #1): after a win we point the user
 * at a category they haven't uploaded, because households that save on one
 * fixed cost usually have room on another.
 */
import {
  PRIMARY_CATEGORIES,
  PRIMARY_META,
  primaryFromLegacy,
  type PrimaryCategory,
} from "@/lib/categories";
import type { Category } from "@/lib/providers";

/** The distinct primary buckets a user already has bills in. */
export function userPrimaryCategories(billCategories: string[]): Set<PrimaryCategory> {
  return new Set(billCategories.map((c) => primaryFromLegacy(c as Category)));
}

/** Primary categories the user has NOT covered (OVERIG excluded). */
export function missingCategories(billCategories: string[]): PrimaryCategory[] {
  const have = userPrimaryCategories(billCategories);
  return PRIMARY_CATEGORIES.filter((c) => c !== "OVERIG" && !have.has(c));
}

// Highest-savings-potential categories first, so the nudge points at the
// most worthwhile gap rather than a random one.
const NUDGE_PRIORITY: PrimaryCategory[] = [
  "ENERGIE",
  "VERZEKERING",
  "TELECOM",
  "WONEN",
  "FINANCIEN",
  "ABONNEMENTEN",
];

/** Pick the single best missing category to nudge about (or null). */
export function pickNudgeCategory(billCategories: string[]): PrimaryCategory | null {
  const missing = missingCategories(billCategories);
  if (missing.length === 0) return null;
  for (const p of NUDGE_PRIORITY) {
    if (missing.includes(p)) return p;
  }
  return missing[0];
}

export function categoryLabel(c: PrimaryCategory): string {
  return PRIMARY_META[c].label;
}
