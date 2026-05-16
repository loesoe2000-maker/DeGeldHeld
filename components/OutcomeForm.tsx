"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Choice = "SUCCESS_SAVED" | "STILL_WAITING" | "FAILED_NO_DEAL";

export default function OutcomeForm({
  negotiationId,
  currentMonthlyCents,
}: {
  negotiationId: string;
  currentMonthlyCents: number;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(c: Choice, body: Record<string, unknown> = {}) {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/negotiations/outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId, outcome: c, ...body }),
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        setError(data.error ?? "Er ging iets mis");
        setPending(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.refresh(), 800);
    } catch {
      setError("Netwerkfout — probeer opnieuw");
      setPending(false);
    }
  }

  function submitSuccess(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = newAmount.replace(/[€\s]/g, "").replace(",", ".");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0 || n >= currentMonthlyCents / 100) {
      setError(`Bedrag moet kleiner zijn dan €${(currentMonthlyCents / 100).toFixed(2).replace(".", ",")}`);
      return;
    }
    const newCents = Math.round(n * 100);
    const savedCents = currentMonthlyCents - newCents;
    submit("SUCCESS_SAVED", { actualSavingsCents: savedCents });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <h2 className="text-xl font-semibold text-emerald-900">Dank je!</h2>
        <p className="mt-2 text-sm text-emerald-800">
          Je bijdrage staat nu in onze Track Record.
        </p>
      </div>
    );
  }

  if (choice === "SUCCESS_SAVED") {
    return (
      <form onSubmit={submitSuccess} className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Wat is je nieuwe maandbedrag?</h2>
        <p className="text-sm text-slate-600">
          Huidig bedrag: €
          {(currentMonthlyCents / 100).toFixed(2).replace(".", ",")}/maand
        </p>
        <input
          type="text"
          inputMode="decimal"
          placeholder="bv 22,50"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChoice(null)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          >
            Terug
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setChoice("SUCCESS_SAVED")}
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-left hover:bg-emerald-100"
      >
        <div>
          <div className="text-lg font-semibold text-emerald-900">✓ Geslaagd</div>
          <div className="text-sm text-emerald-700">Provider heeft korting gegeven</div>
        </div>
        <span className="text-emerald-700">→</span>
      </button>
      <button
        type="button"
        onClick={() => submit("STILL_WAITING")}
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-left hover:bg-amber-100 disabled:opacity-50"
      >
        <div>
          <div className="text-lg font-semibold text-amber-900">⏳ Nog wachten</div>
          <div className="text-sm text-amber-700">Geen antwoord ontvangen</div>
        </div>
        <span className="text-amber-700">→</span>
      </button>
      <button
        type="button"
        onClick={() => submit("FAILED_NO_DEAL")}
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-left hover:bg-red-100 disabled:opacity-50"
      >
        <div>
          <div className="text-lg font-semibold text-red-900">✗ Geweigerd</div>
          <div className="text-sm text-red-700">Geen korting gekregen</div>
        </div>
        <span className="text-red-700">→</span>
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
