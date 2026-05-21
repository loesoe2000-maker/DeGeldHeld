"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * v23 — relay control buttons. When AWAITING_APPROVAL the customer sees
 * Accept / Continue / Stop (the human-in-the-loop gate). Pause/Resume is
 * always available so the customer can stop automatic mails at any time.
 */
export default function RelayControls({
  negotiationId,
  relayState,
}: {
  negotiationId: string;
  relayState: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, action: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/negotiations/${negotiationId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        setError("Actie mislukt — probeer het opnieuw.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
      setBusy(false);
    }
  }

  const awaiting = relayState === "AWAITING_APPROVAL";
  const paused = relayState === "PAUSED";
  const done = relayState === "DONE";

  return (
    <div data-testid="relay-controls" className="mt-4 flex flex-wrap gap-3">
      {awaiting && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => post("relay-approve", "accept")}
            data-testid="relay-accept"
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            Accepteer deal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => post("relay-approve", "continue")}
            data-testid="relay-continue"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Blijf onderhandelen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => post("relay-approve", "stop")}
            data-testid="relay-stop"
            className="rounded-lg border border-rose-300 px-5 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            Stop
          </button>
        </>
      )}
      {!awaiting && !done && (
        <button
          type="button"
          disabled={busy}
          onClick={() => post("relay-pause", paused ? "resume" : "pause")}
          data-testid="relay-pause-toggle"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {paused ? "Hervat automatisch onderhandelen" : "Pauzeer / stop"}
        </button>
      )}
      {error && <p className="w-full text-sm text-rose-700">{error}</p>}
    </div>
  );
}
