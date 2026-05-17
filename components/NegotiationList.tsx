import Link from "next/link";
import { formatEurCents, formatRelativeDate } from "@/lib/format";
import { negotiationLabel, tierClass } from "@/lib/savings";
import type { Bill, Negotiation } from "@prisma/client";

type Item = Negotiation & {
  bill: Pick<Bill, "provider" | "amountCents" | "category"> & { nextRecheckAt?: Date | null };
};

function formatDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export default function NegotiationList({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm" aria-label="Onderhandelingen">
      {items.map((n) => (
        <li key={n.id} className="p-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{n.bill.provider}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierClass(n.state)}`}>
                {negotiationLabel(n.state)}
              </span>
              {n.bill.nextRecheckAt && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600" title="Maandelijkse markt-recheck">
                  Volgende check: {formatDate(n.bill.nextRecheckAt)}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {formatEurCents(n.bill.amountCents)} per maand · {formatRelativeDate(n.createdAt)}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 sm:mt-0">
            {n.actualSavingsCents != null && n.actualSavingsCents > 0 && (
              <span className="text-brand-700 font-bold">
                +{formatEurCents(n.actualSavingsCents, { showDecimals: false })}/jr
              </span>
            )}
            <Link
              href={`/onderhandel/${n.id}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Bekijk →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
