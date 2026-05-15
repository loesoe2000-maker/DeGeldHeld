export default function EmailLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="h-9 w-56 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="h-4 w-44 animate-pulse rounded bg-brand-200/70" />
          <div className="mt-2 h-7 w-32 animate-pulse rounded bg-brand-200/70" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-6 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 h-3 w-full animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    </main>
  );
}
