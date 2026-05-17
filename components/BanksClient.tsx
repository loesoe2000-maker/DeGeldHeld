"use client";

import { useState } from "react";

export default function BanksClient({ hasConnection }: { hasConnection: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/psd2/connect", { method: "POST" });
      const data = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !data.url) {
        setError(data.error ?? "Kon Tink-link niet ophalen");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Netwerkfout");
      setPending(false);
    }
  }

  async function sync() {
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/psd2/sync", { method: "POST" });
      if (!r.ok) setError("Sync mislukt");
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={connect}
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {hasConnection ? "Extra bank koppelen" : "Koppel je bank"}
      </button>
      {hasConnection && (
        <button
          type="button"
          onClick={sync}
          disabled={pending}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Sync nu
        </button>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
