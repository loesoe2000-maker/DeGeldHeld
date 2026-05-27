"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * v36 idee 4 — delete-knop met inline-confirm. Eén klik → "weet je het zeker?".
 * Tweede klik → DELETE call. Bij succes refresh'en we de server-page.
 */
export default function DocumentDeleteButton({ documentId }: { documentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function doDelete() {
    setError(null);
    const res = await fetch(`/api/account/documents/${documentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "Verwijderen mislukt." }))) as {
        error?: string;
      };
      setError(body.error ?? "Verwijderen mislukt.");
      return;
    }
    setConfirming(false);
    startTransition(() => router.refresh());
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        data-testid={`document-delete-${documentId}`}
        className="shrink-0 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        Verwijderen
      </button>
    );
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={isPending}
        onClick={doDelete}
        data-testid={`document-delete-confirm-${documentId}`}
        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {isPending ? "Bezig…" : "Bevestig"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Annuleer
      </button>
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
