"use client";

import { useState } from "react";
import { parseEurInput } from "@/lib/format";
import { DOCUMENT_KIND_LABEL, type DocumentKind } from "@/lib/user-documents";

/**
 * V35 DEEL 2 — Energie-uitspraak upload (client component).
 * v37 — klant kan nu kiezen: nieuw bestand uploaden óf een document uit z'n
 * kluis hergebruiken (documentId). Zelfde patroon als Huur.
 */
export type VaultDoc = {
  id: string;
  kind: string;
  filename: string;
  createdAt: string;
};

export default function EnergieUitspraakUpload({
  claimId,
  vaultDocs = [],
}: {
  claimId: string;
  vaultDocs?: VaultDoc[];
}) {
  const [werkelijke, setWerkelijke] = useState("");
  const [mode, setMode] = useState<"nieuw" | "kluis">("nieuw");
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState<string>(vaultDocs[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.append("claimId", claimId);
    fd.append("werkelijkeRestitutieCents", String(parseEurInput(werkelijke) ?? ""));

    if (mode === "kluis") {
      if (!docId) {
        setError("Kies een document uit je kluis.");
        return;
      }
      fd.append("documentId", docId);
    } else {
      if (!file) {
        setError("Kies een PDF of foto van de uitspraak.");
        return;
      }
      fd.append("file", file);
    }

    setBusy(true);
    const res = await fetch("/api/energie-claim/uitspraak", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Upload mislukt — probeer opnieuw.");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  }

  if (done) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Uitspraak ontvangen — we verwerken je claim.
      </div>
    );
  }

  const hasVault = vaultDocs.length > 0;

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Werkelijk teruggekregen bedrag (optioneel)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={werkelijke}
          onChange={(e) => setWerkelijke(e.target.value)}
          placeholder="bv. 120,00"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {hasVault ? (
        <div className="flex gap-2 text-sm" data-testid="energie-uitspraak-mode">
          <button
            type="button"
            onClick={() => setMode("nieuw")}
            className={`rounded-lg border px-3 py-1.5 font-medium ${
              mode === "nieuw"
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-300 text-slate-600"
            }`}
          >
            Nieuw bestand
          </button>
          <button
            type="button"
            onClick={() => setMode("kluis")}
            data-testid="energie-uitspraak-kies-kluis"
            className={`rounded-lg border px-3 py-1.5 font-medium ${
              mode === "kluis"
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-300 text-slate-600"
            }`}
          >
            Uit mijn kluis
          </button>
        </div>
      ) : null}

      {mode === "kluis" && hasVault ? (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Kies een document uit je kluis
          </label>
          <select
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            data-testid="energie-uitspraak-doc-select"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {vaultDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {(DOCUMENT_KIND_LABEL[d.kind as DocumentKind] ?? d.kind)} — {d.filename}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Uitspraak (PDF of foto)
          </label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Bezig…" : "Upload uitspraak"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
