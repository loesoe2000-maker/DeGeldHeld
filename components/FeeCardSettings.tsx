"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * v19 — /account: show whether a no-cure-no-pay card is linked + let the
 * user link one or withdraw the mandate (detach card). Consumer right to
 * revoke at any time.
 */
export default function FeeCardSettings({ hasCard }: { hasCard: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function linkCard() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/fee-setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo: "/account" }),
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

  async function removeCard() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/fee-setup", { method: "DELETE" });
      if (!r.ok) {
        setError("Kon de kaart niet verwijderen.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
      setBusy(false);
    }
  }

  return (
    <section data-testid="fee-card-settings" className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Automatische fee-betaling</h2>
      {hasCard ? (
        <>
          <p className="mt-1 text-sm text-slate-600">
            ✓ Er is een kaart gekoppeld. Bij een <strong>bewezen besparing</strong>{" "}
            schrijven we automatisch de no-cure-no-pay fee af (20%, max €500).
            Je kunt dit mandaat altijd intrekken.
          </p>
          <button
            type="button"
            onClick={removeCard}
            disabled={busy}
            data-testid="fee-card-remove"
            className="mt-3 rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            {busy ? "Bezig…" : "Kaart verwijderen / mandaat intrekken"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Koppel (optioneel) een kaart zodat we de fee automatisch kunnen
            innen bij een bewezen besparing. Je betaalt nu €0 en kunt altijd
            opzeggen. Geen kaart? Dan vragen we de fee gewoon handmatig achteraf.
          </p>
          <button
            type="button"
            onClick={linkCard}
            disabled={busy}
            data-testid="fee-card-link"
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? "Even geduld…" : "Kaart koppelen"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
