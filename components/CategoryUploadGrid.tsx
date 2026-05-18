import Link from "next/link";
import {
  PRIMARY_CATEGORIES,
  PRIMARY_META,
  primaryFromLegacy,
  type PrimaryCategory,
} from "@/lib/categories";
import type { Category } from "@/lib/providers";

/**
 * v10: show the 7 primary categories as clickable upload slots (was 14
 * legacy enums). The "filled" lookup maps every legacy enum the user
 * has bills in onto its primary bucket before checking — so a user
 * with a STREAMING-bill marks the ABONNEMENTEN slot as filled.
 */
export default function CategoryUploadGrid({
  filledCategories,
}: {
  filledCategories: Category[];
}) {
  const filled = new Set<PrimaryCategory>(filledCategories.map(primaryFromLegacy));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {PRIMARY_CATEGORIES.map((primary) => {
        const meta = PRIMARY_META[primary];
        const done = filled.has(primary);
        return (
          <Link
            key={primary}
            href={`/onderhandel?cat=${primary}`}
            className={`rounded-xl border p-4 transition hover:shadow-sm ${
              done
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="text-2xl">{meta.icon}</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{meta.label}</div>
            <div className="mt-1 text-xs text-slate-500">
              {done ? "✓ ingevuld" : "Klik om te uploaden"}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
