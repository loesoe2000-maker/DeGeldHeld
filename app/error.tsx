"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Browsers / Sentry pickup gebeurt automatisch via sentry.client.config.ts
    // Hier alleen lokale console-log voor debug.
    console.error("Page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 text-6xl font-bold text-rose-300">!</div>
      <h1 className="text-3xl font-bold text-slate-900">Er ging iets mis</h1>
      <p className="mt-3 max-w-md text-slate-600">
        We konden deze pagina niet laden. Het probleem is automatisch gemeld
        — probeer opnieuw, of neem contact op via{" "}
        <a href="mailto:hallo@degeldheld.nl" className="font-medium text-brand-700 underline">
          hallo@degeldheld.nl
        </a>
        .
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-slate-400">
          Foutcode: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Probeer opnieuw
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          Terug naar home
        </Link>
      </div>
    </main>
  );
}
