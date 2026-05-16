import Link from "next/link";
import { CATEGORY_RULES } from "@/lib/categories";
import type { Category } from "@/lib/providers";

/**
 * Show all 14 categories as clickable upload slots. Categories the user
 * already has bills in are marked "✓ ingevuld"; the rest invite an upload.
 */
export default function CategoryUploadGrid({
  filledCategories,
}: {
  filledCategories: Category[];
}) {
  const filled = new Set(filledCategories);
  const cats = Object.values(CATEGORY_RULES);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cats.map((c) => {
        const done = filled.has(c.id);
        return (
          <Link
            key={c.id}
            href={`/onderhandel?cat=${c.id}`}
            className={`rounded-xl border p-4 transition hover:shadow-sm ${
              done
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{c.label}</div>
            <div className="mt-1 text-xs text-slate-500">
              {done ? "✓ ingevuld" : c.negotiable ? "Klik om te uploaden" : "Monitoring"}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
