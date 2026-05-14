export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-slate-200 ${className}`}
    />
  );
}

export function SavingsCardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-9 w-24" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function NegotiationListSkeleton() {
  return (
    <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
      {[0, 1, 2].map((i) => (
        <li key={i} className="p-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
          </div>
          <Skeleton className="mt-3 h-4 w-24 sm:mt-0" />
        </li>
      ))}
    </ul>
  );
}

export function ComparisonSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-6 w-48" />
      </div>
      <div className="rounded-xl bg-brand-50 p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-10 w-32" />
      </div>
    </div>
  );
}
