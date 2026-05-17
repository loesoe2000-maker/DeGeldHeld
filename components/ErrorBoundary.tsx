"use client";

/**
 * components/ErrorBoundary.tsx
 *
 * Shared visual + Sentry-capture for every route-level error.tsx so the
 * UI stays consistent. Renders an amber banner + "Probeer opnieuw" button
 * + (when Sentry returns one) the eventId so support can correlate.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  area?: string; // optional route-tree label for the Sentry tag
};

export default function ErrorBoundary({ error, reset, area }: Props) {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    let captured: string | undefined;
    void (async () => {
      try {
        const Sentry = await import("@sentry/nextjs");
        captured = Sentry.captureException(error, {
          tags: { area: area ?? "unknown" },
          extra: { digest: error.digest },
        });
        if (captured) setEventId(captured);
      } catch {
        // Sentry not configured — silently skip
      }
    })();
    console.error(`[error-boundary:${area ?? "unknown"}]`, error);
  }, [error, area]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div
        role="alert"
        className="w-full rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900"
      >
        <h1 className="text-xl font-semibold">Er ging iets mis</h1>
        <p className="mt-2 text-sm">
          We konden deze pagina niet laden. Het probleem is automatisch gemeld.
          Probeer het opnieuw, of mail{" "}
          <a href="mailto:hallo@degeldheld.com" className="font-medium underline">
            hallo@degeldheld.com
          </a>
          .
        </p>
        {(eventId || error.digest) && (
          <p className="mt-3 font-mono text-xs text-amber-700">
            Foutcode: {eventId ?? error.digest}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
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
