"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

/** Supported categories the user can pick (hypotheek/verzekering excluded — AFM). */
const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "TELECOM", label: "Telecom / internet" },
  { value: "ENERGIE", label: "Energie" },
  { value: "WATER", label: "Water" },
  { value: "STREAMING", label: "Streaming" },
  { value: "ABONNEMENT", label: "Abonnement" },
  { value: "GYM", label: "Sportschool" },
  { value: "SOFTWARE", label: "Software" },
  { value: "OPSLAG", label: "Cloud-opslag" },
  { value: "OV", label: "OV" },
  { value: "BANK", label: "Bank" },
  { value: "OVERIG", label: "Overig" },
];

export default function OcrCorrectionForm({
  billId,
  currentProvider,
  currentMonthlyCents,
  currentCategory,
  providers,
}: {
  billId: string;
  currentProvider: string;
  currentMonthlyCents: number;
  currentCategory: string;
  providers: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(currentProvider === "Onbekend" ? "" : currentProvider);
  const [amount, setAmount] = useState(
    currentMonthlyCents > 0 ? (currentMonthlyCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [category, setCategory] = useState(currentCategory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const payload: { provider?: string; monthlyCents?: number; category?: string } = {};
    const changedFields: string[] = [];
    if (provider.trim() && provider.trim() !== currentProvider) {
      payload.provider = provider.trim();
      changedFields.push("provider");
    }
    if (category && category !== currentCategory) {
      payload.category = category;
      changedFields.push("category");
    }
    const cleaned = amount.replace(/[€\s]/g, "").replace(",", ".");
    const n = Number(cleaned);
    if (amount.trim()) {
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        setError("Vul een geldig maandbedrag in (€0,01 – €1000).");
        return;
      }
      const cents = Math.round(n * 100);
      if (cents !== currentMonthlyCents) {
        payload.monthlyCents = cents;
        changedFields.push("amount");
      }
    }
    if (changedFields.length === 0) {
      setError("Niets gewijzigd.");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch(`/api/bills/${billId}/correct`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Correctie mislukt.");
        setBusy(false);
        return;
      }
      for (const f of changedFields) track("ocr_corrected", { field: f });
      router.refresh();
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="ocr-correct-open"
        className="mt-4 text-sm font-medium text-brand-700 underline hover:text-brand-800"
      >
        Klopt dit niet? Pas aan
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      data-testid="ocr-correct-form"
      className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-slate-700">Corrigeer de gelezen gegevens</p>
      <label className="block text-sm text-slate-600">
        Provider
        <input
          list="provider-options"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="bijv. KPN"
        />
        <datalist id="provider-options">
          {providers.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <label className="block text-sm text-slate-600">
        Maandbedrag (€)
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="bijv. 29,95"
        />
      </label>
      <label className="block text-sm text-slate-600">
        Categorie
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          data-testid="ocr-correct-submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? "Bezig…" : "Opslaan & opnieuw analyseren"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
