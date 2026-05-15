import { SavingsCardSkeleton, NegotiationListSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-8">
        <SavingsCardSkeleton />
      </div>
      <div className="mt-10">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-3">
          <NegotiationListSkeleton />
        </div>
      </div>
    </main>
  );
}
