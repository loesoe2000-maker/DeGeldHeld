import Link from "next/link";

export default function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl">
        💸
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-900">
        Nog geen onderhandelingen
      </h2>
      <p className="mt-2 text-slate-600">
        Upload je eerste rekening en wij gaan voor je onderhandelen.
      </p>
      <Link
        href="/onderhandel"
        className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
      >
        Eerste onderhandeling starten
      </Link>
    </div>
  );
}
