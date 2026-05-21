"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import FeeMandatePrompt from "@/components/FeeMandatePrompt";

/**
 * v23/v25 — consent UI for negotiate-on-behalf. Soft, opt-in: without it the
 * manual one-click-copy flow stays. v25 completes the missing link:
 *
 *   - CARD-FIRST (GUARDRAIL 4): no fee-card on file → show the card-link step
 *     instead of the start button. Relay can't authorize without a chargeable card.
 *   - PROVIDER ADDRESS (the missing link): a verified registry address is sent
 *     automatically; otherwise the customer types the address from their invoice.
 *   - Posting still requires the explicit checkbox; the server records the exact
 *     accepted mandate text (audit) and fires the first relay mail.
 *
 * `mandateText` + `resolvedProviderEmail` are computed server-side (lib/relay.ts
 * imports node:crypto, so it must not be pulled into this client bundle).
 */
export default function RelayConsentPrompt({
  negotiationId,
  provider,
  hasFeeCard,
  resolvedProviderEmail,
  mandateText,
  returnTo,
}: {
  negotiationId: string;
  provider: string;
  hasFeeCard: boolean;
  resolvedProviderEmail: string | null;
  mandateText: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only shown when the registry has no verified address for this provider.
  const [manualEmail, setManualEmail] = useState("");

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // GUARDRAIL 4 — no chargeable card → no relay. Send the customer to the
  // card-link step (the same no-cure-no-pay mandate used for the manual flow).
  if (!hasFeeCard) {
    return (
      <section
        data-testid="relay-card-required"
        className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5"
      >
        <h2 className="text-lg font-semibold text-brand-900">
          Laat DeGeldHeld namens jou onderhandelen
        </h2>
        <p className="mt-1 text-sm text-brand-900">
          Wij doen het werk en mailen namens jou met {provider}. Koppel eerst je
          kaart — je betaalt <strong>€0 nu</strong>, en pas 20% áls we een
          besparing bewijzen. Zonder gekoppelde kaart kunnen we niet namens jou
          onderhandelen.
        </p>
        <FeeMandatePrompt returnTo={returnTo} />
      </section>
    );
  }

  async function authorize() {
    if (!agreed || busy) return;

    // Determine the provider address: verified registry hit → use it; else the
    // customer-typed address (validated). No address → can't start.
    let providerEmail = resolvedProviderEmail;
    if (!providerEmail) {
      const typed = manualEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(typed)) {
        setError("Vul een geldig e-mailadres van de klantenservice in.");
        return;
      }
      providerEmail = typed;
    }

    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/negotiations/${negotiationId}/relay-authorize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerEmail }),
      });
      if (r.status === 409) {
        // card-required race (card removed mid-flow) → surface, don't loop.
        setError("Koppel eerst je kaart om namens jou te kunnen onderhandelen.");
        setBusy(false);
        return;
      }
      if (!r.ok) {
        setError("Kon de machtiging niet opslaan.");
        setBusy(false);
        return;
      }
      track("relay_authorized"); // no PII
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

      {resolvedProviderEmail ? (
        <p
          data-testid="relay-provider-known"
          className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm text-brand-900"
        >
          We mailen namens jou naar de klantenservice van {provider}.
        </p>
      ) : (
        <label className="mt-3 block text-sm text-brand-900">
          <span className="font-medium">
            E-mailadres klantenservice van {provider}
          </span>
          <span className="block text-xs text-brand-700">
            Dit staat vaak op je factuur of in je account.
          </span>
          <input
            type="email"
            inputMode="email"
            data-testid="relay-provider-email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder={`klantenservice@${provider.toLowerCase().replace(/[^a-z0-9]/g, "")}.nl`}
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
          />
        </label>
      )}

      <label className="mt-3 flex items-start gap-2 text-sm text-brand-900">
        <input
          type="checkbox"
          data-testid="relay-consent-agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          {mandateText} Zie de{" "}
          <a href="/voorwaarden" className="underline">voorwaarden</a>.
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
        kopieer-knop hierboven.
      </p>
    </section>
  );
}
