"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * v23 — consent UI for negotiate-on-behalf (DEEL 1). Soft, opt-in: without
 * it the manual one-click-copy flow stays. Posting requires the explicit
 * checkbox; the server records the exact accepted text (audit).
 */
export default function RelayConsentPrompt({
  negotiationId,
  provider,
}: {
  negotiationId: string;
  provider: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function authorize() {
    if (!agreed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/negotiations/${negotiationId}/relay-authorize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        setError("Kon de machtiging niet opslaan.");
        setBusy(false);
        return;
      }
      track("relay_authorized");
      router.refresh();
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
      setBusy(false);
    }
  }

  return (
    <section
      data-testid="relay-consent"
      className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5"
    >
      <h2 className="text-lg font-semibold text-brand-900">
        Laat DeGeldHeld namens jou onderhandelen
      </h2>
      <p className="mt-1 text-sm text-brand-900">
        Wil je dat DeGeldHeld <strong>namens jou</strong> met {provider}
        onderhandelt? We sturen e-mails namens jou en counteren automatisch op
        routine-antwoorden. <strong>Elke deal of definitieve mail keur jij
        eerst goed</strong> — we leggen nooit zelf een akkoord vast. Je kunt
        altijd pauzeren of stoppen.
      </p>
      <label className="mt-3 flex items-start gap-2 text-sm text-brand-900">
        <input
          type="checkbox"
          data-testid="relay-consent-agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Ik machtig DeGeldHeld om namens mij te onderhandelen met {provider}
          (volmacht, beperkt tot onderhandelen — niet tot het accepteren van een
          contract). Zie de <a href="/voorwaarden" className="underline">voorwaarden</a>.
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <button
        type="button"
        onClick={authorize}
        disabled={!agreed || busy}
        data-testid="relay-consent-start"
        className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
      >
        {busy ? "Bezig…" : "Start automatisch onderhandelen"}
      </button>
      <p className="mt-2 text-xs text-brand-700">
        Liever zelf mailen? Sla dit over — dan gebruik je gewoon de
        kopieer-knop hieronder.
      </p>
    </section>
  );
}
