"use client";

import { useState } from "react";

/**
 * v19 — soft no-cure-no-pay consent + card-link step. NOT a hard gate: a
 * user who skips falls back to the existing manual fee-flow after a win.
 * The exact accepted text is sent to /api/fee-setup as feeMandateText (audit).
 */
export const FEE_MANDATE_TEXT =
  "No cure, no pay. Je betaalt nu €0. Alleen áls we een besparing bewijzen, " +
  "schrijven we eenmalig 20% van de jaarbesparing af (max €500, min €2, " +
  "drempel €25/jaar). Je kunt je kaart en dit mandaat altijd intrekken via je account.";

export default function FeeMandatePrompt({ returnTo }: { returnTo: string }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function linkCard() {
    if (!agreed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/fee-setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo, mandateText: FEE_MANDATE_TEXT }),
      });
      const data = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !data.url) {
        setError(data.error ?? "Kon de kaart-koppeling niet starten.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
      setBusy(false);
    }
  }

  return (
    <section
      data-testid="fee-mandate-prompt"
      className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5"
    >
      <h2 className="text-lg font-semibold text-brand-900">No cure, no pay</h2>
      <p className="mt-1 text-sm text-brand-900">
        Je betaalt <strong>nu €0</strong>. Alleen áls we een besparing
        bewijzen, schrijven we eenmalig <strong>20%</strong> van de
        jaarbesparing af (max €500, min €2, drempel €25/jaar). Je kunt altijd
        opzeggen.
      </p>
      <label className="mt-3 flex items-start gap-2 text-sm text-brand-900">
        <input
          type="checkbox"
          data-testid="fee-mandate-agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>Ik ga akkoord met de no-cure-no-pay voorwaarden.</span>
      </label>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <button
        type="button"
        onClick={linkCard}
        disabled={!agreed || busy}
        className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
      >
        {busy ? "Even geduld…" : "Koppel kaart & start onderhandeling"}
      </button>
      <p className="mt-2 text-xs text-brand-700">
        Zonder gekoppelde kaart blijft de volledige onderhandel-mail
        vergrendeld. Je betaalt nog steeds <strong>€0</strong> nu — pas 20%
        áls je écht bespaart, en je kunt je kaart altijd weer intrekken.
      </p>
    </section>
  );
}
