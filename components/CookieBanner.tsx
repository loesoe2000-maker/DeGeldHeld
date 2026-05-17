"use client";

/**
 * components/CookieBanner.tsx
 *
 * Minimal-cookie banner. On first visit shows three buttons:
 *   - Akkoord         → "all" (incl. Sentry telemetry)
 *   - Alleen functioneel → "functional" (no analytics, no Sentry)
 *   - Lees meer        → /privacy
 *
 * Choice is persisted both to localStorage (instant re-load) and to the
 * dgh_consent cookie (sent server-side so server code can opt-out too).
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type Consent = "all" | "functional";

const STORAGE_KEY = "dgh_consent";

function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "all" || v === "functional" ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(c: Consent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, c);
  } catch {
    // Storage might be blocked — cookie still works.
  }
  // 1 year cookie, SameSite=Lax, not HttpOnly (so client code can read it too)
  document.cookie = `${STORAGE_KEY}=${c}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  // Best-effort opt-out hint for downstream analytics
  if (c === "functional") {
    (window as unknown as { __dghDisableTracking?: boolean }).__dghDisableTracking = true;
  }
}

export default function CookieBanner() {
  const [needsChoice, setNeedsChoice] = useState(false);

  useEffect(() => {
    setNeedsChoice(readConsent() === null);
  }, []);

  if (!needsChoice) return null;

  function decide(c: Consent) {
    writeConsent(c);
    setNeedsChoice(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie-toestemming"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg sm:p-5"
    >
      <p className="text-sm text-amber-900">
        We gebruiken minimale cookies voor functionaliteit (login, taalkeuze,
        deze keuze). Voor anonieme foutmeldingen via Sentry vragen we apart
        toestemming. Geen tracking zonder akkoord.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("all")}
          className="min-h-[44px] rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Akkoord
        </button>
        <button
          type="button"
          onClick={() => decide("functional")}
          className="min-h-[44px] rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          Alleen functioneel
        </button>
        <Link
          href="/privacy"
          className="min-h-[44px] inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-amber-900 underline"
        >
          Lees meer
        </Link>
      </div>
    </div>
  );
}
