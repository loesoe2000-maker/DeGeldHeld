"use client";

/**
 * app/global-error.tsx
 *
 * Top-level fallback for crashes that happen *during* the root layout
 * render (e.g. a thrown error in providers, fonts, metadata). Must
 * render its own <html>/<body> because it replaces the root layout.
 */
import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const Sentry = await import("@sentry/nextjs");
        const id = Sentry.captureException(error, {
          tags: { area: "global-error" },
          extra: { digest: error.digest },
        });
        if (id) setEventId(id);
      } catch {
        // Sentry not configured
      }
    })();
  }, [error]);

  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          background: "#fffbeb",
          color: "#78350f",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <main
          role="alert"
          style={{
            maxWidth: 560,
            background: "#fff",
            border: "1px solid #fde68a",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, margin: 0 }}>Er ging iets goed mis</h1>
          <p style={{ marginTop: 12 }}>
            We konden de site niet laden. Het probleem is automatisch
            gemeld. Probeer over een paar minuten opnieuw.
          </p>
          {(eventId || error.digest) && (
            <p
              style={{
                marginTop: 12,
                fontFamily: "monospace",
                fontSize: 12,
                color: "#92400e",
              }}
            >
              Foutcode: {eventId ?? error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Probeer opnieuw
          </button>
        </main>
      </body>
    </html>
  );
}
