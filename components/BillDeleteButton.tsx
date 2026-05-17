"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BillDeleteButton({ billId, provider }: { billId: string; provider: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  async function doDelete() {
    setPending(true);
    try {
      const r = await fetch(`/api/bills/${billId}`, { method: "DELETE" });
      if (r.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        aria-label={`Verwijder ${provider}`}
        className="text-xs text-rose-600 hover:underline"
      >
        Verwijder
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-rose-700">Zeker?</span>
      <button
        type="button"
        onClick={doDelete}
        disabled={pending}
        className="rounded bg-rose-600 px-2 py-0.5 font-medium text-white disabled:opacity-50"
      >
        Ja
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="rounded border border-slate-300 px-2 py-0.5 text-slate-600"
      >
        Nee
      </button>
    </span>
  );
}
