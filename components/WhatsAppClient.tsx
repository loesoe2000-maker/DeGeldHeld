"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  pendingApproval: boolean;
  receivedAt: string;
};

export default function WhatsAppClient({
  negotiationId,
  billId: _billId,
  provider,
  existingThread,
}: {
  negotiationId: string;
  billId: string;
  provider: string;
  existingThread: { providerNumber: string; messages: Msg[] } | null;
}) {
  const router = useRouter();
  const [number, setNumber] = useState(existingThread?.providerNumber ?? "");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  async function activate() {
    setActivating(true);
    setError(null);
    try {
      const r = await fetch("/api/whatsapp/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId, providerNumber: number }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) setError(data.error ?? "Activatie mislukt");
      else router.refresh();
    } finally {
      setActivating(false);
    }
  }

  async function approve(msgId: string) {
    setSending(msgId);
    setError(null);
    try {
      const r = await fetch("/api/outbound/whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: msgId }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) setError(data.error ?? "Verzenden mislukt");
      else router.refresh();
    } finally {
      setSending(null);
    }
  }

  if (!existingThread) {
    return (
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Activeer WhatsApp tracking voor {provider}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vul het WhatsApp-nummer van de retentie-afdeling in (formaat <code>+31612345678</code>).
          Wij ontvangen dan antwoorden via dit nummer en bereiden counters voor.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="tel"
            placeholder="+31612345678"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            data-testid="wa-provider-number"
          />
          <button
            type="button"
            onClick={activate}
            disabled={activating || number.length < 6}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {activating ? "Activeren…" : "Activeer"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <strong>Actief.</strong> Provider-nummer: <code className="font-mono">{existingThread.providerNumber}</code>
      </div>
      <ol className="space-y-3">
        {existingThread.messages.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Nog geen berichten. Stuur een eerste WhatsApp naar provider — antwoorden landen hier.
          </li>
        )}
        {existingThread.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-4 text-sm ${
              m.direction === "inbound"
                ? "border-slate-200 bg-white"
                : m.pendingApproval
                ? "border-amber-300 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="text-xs text-slate-500">
              {m.direction === "inbound" ? `↓ ${provider} schreef` : m.pendingApproval ? "⏸ AI-counter (akkoord vereist)" : "↑ Jij stuurde"}
              {" · "}
              {new Date(m.receivedAt).toLocaleString("nl-NL")}
            </div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-slate-800">{m.body}</pre>
            {m.pendingApproval && (
              <button
                type="button"
                onClick={() => approve(m.id)}
                disabled={sending === m.id}
                className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                data-testid="wa-approve"
              >
                {sending === m.id ? "Versturen…" : "Akkoord, verstuur"}
              </button>
            )}
          </li>
        ))}
      </ol>
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </section>
  );
}
