"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrainingReviewForm({
  sampleId,
  initialJson,
}: {
  sampleId: string;
  initialJson: string;
}) {
  const router = useRouter();
  const [json, setJson] = useState(() => {
    try {
      return JSON.stringify(JSON.parse(initialJson), null, 2);
    } catch {
      return initialJson;
    }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/training", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sampleId, anonymizedJson: json }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) setError(data.error ?? "Save failed");
      else router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={10}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
      />
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Opslaan…" : "Mark reviewed"}
      </button>
    </div>
  );
}
