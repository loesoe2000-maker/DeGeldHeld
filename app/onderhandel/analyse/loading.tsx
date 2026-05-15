import { ComparisonSkeleton } from "@/components/Skeleton";

export default function AnalyseLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="h-9 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-8">
        <ComparisonSkeleton />
      </div>
    </main>
  );
}
