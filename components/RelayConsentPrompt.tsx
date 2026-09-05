"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import type { RelayChannel } from "@/lib/relay-providers";

/**
 * v23/v25/v26 — consent UI for negotiate-on-behalf. Soft, opt-in: without it
 * the manual one-click-copy flow stays.
 *
 *   - CARD-FIRST (GUARDRAIL 4): no fee-card → show the card-link step.
 *   - CONFIRM-BEFORE-SEND (v26): a verified registry address is shown and must
 *     be CONFIRMED ("klopt dit?") before the first mail goes out; the customer
 *     can change it. No verified address → a manual address is REQUIRED.
 *   - HONEST EXPECTATION (v26): for a "no-email" provider we say e-mail works
 *     poorly there instead of pretending.
 *   - The explicit consent checkbox is always required; the server records the
 *     exact accepted mandate text and fires the first relay mail.
 */
export default function RelayConsentPrompt({
  negotiationId,
  provider,
  resolvedProviderEmail,
  channel,
  noEmailNote,
  mandateText,
  returnTo,
}: {
  negotiationId: string;
  provider: string;
  resolvedProviderEmail: string | null;
  channel: RelayChannel;
  noEmailNote: string | null;
  mandateText: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A verified address starts in "verify" mode (confirm/change); otherwise the
  // customer must type one ("manual" mode from the start).
  const hasVerified = !!resolvedProviderEmail;
  const [editing, setEditing] = useState(!hasVerified);
  const [confirmed, setConfirmed] = useState(false);
  const [manualEmail, setManualEmail] = useState("");

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // v41 — GRATIS PLATFORM: GUARDRAIL 4 (geen kaart → geen relay) is
  // vervallen. Relay hangt nu alleen nog aan RELAY_ENABLED + jouw toestemming.


  // The address we'll actually send to + whether we're cleared to start.
  const effectiveEmail = editing ? manualEmail.trim().toLowerCase() : resolvedProviderEmail;
  const addressReady = editing ? EMAIL_RE.test(manualEmail.trim().toLowerCase()) : confirmed;
  const canStart = agreed && addressReady && !busy;

  async function authorize() {
    if (!agreed) return;
    if (!addressReady || !effectiveEmail || !EMAIL_RE.test(effectiveEmail)) {
      setError(
        editing
          ? "Vul een geldig e-mailadres van de klantenservice in."
          : "Bevestig eerst het e-mailadres.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/negotiations/${negotiationId}/relay-authorize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerEmail: effectiveEmail }),
      });
      if (r.status === 409) {
        const reason = (await r.json().catch(() => ({})))?.reason;
        setError(
          reason === "card-required"
            ? "Koppel eerst je kaart om namens jou te kunnen onderhandelen."
            : reason === "address-required"
              ? "Vul of bevestig eerst een e-mailadres."
              : "Kon de machtiging niet opslaan.",
        );
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

      {/* Honest expectation for providers that don't do email. */}
      {channel === "no-email" && noEmailNote && (
        <p
          data-testid="relay-no-email-note"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {noEmailNote} Vul hieronder een adres in als je het hebt — anders kun
          je deze onderhandeling beter zelf doen.
        </p>
      )}

      {/* Verified address → confirm-before-send. */}
      {!editing && hasVerified ? (
        <div data-testid="relay-confirm-address" className="mt-3 rounded-lg bg-white/60 px-3 py-3 text-sm text-brand-900">
          <p>
            We mailen namens jou naar{" "}
            <strong data-testid="relay-resolved-email">{resolvedProviderEmail}</strong> — klopt dit?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="relay-confirm-yes"
              onClick={() => { setConfirmed(true); setError(null); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                confirmed
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {confirmed ? "✓ Bevestigd" : "Ja, klopt"}
            </button>
            <button
              type="button"
              data-testid="relay-confirm-change"
              onClick={() => { setEditing(true); setConfirmed(false); setManualEmail(resolvedProviderEmail ?? ""); }}
              className="rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-white"
            >
              Wijzig
            </button>
          </div>
        </div>
      ) : (
        <label className="mt-3 block text-sm text-brand-900">
          <span className="font-medium">
            E-mailadres klantenservice van {provider}
          </span>
          <span className="block text-xs text-brand-700">
            Staat op je factuur of in de app/account.
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
        disabled={!canStart}
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
