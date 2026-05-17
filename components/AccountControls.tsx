"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function AccountControls({
  initialNotificationsEnabled,
  initialOcrTrainingOptIn,
}: {
  initialNotificationsEnabled: boolean;
  initialOcrTrainingOptIn: boolean;
}) {
  const [notif, setNotif] = useState(initialNotificationsEnabled);
  const [optIn, setOptIn] = useState(initialOcrTrainingOptIn);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function persist(next: { notificationsEnabled?: boolean; ocrTrainingOptIn?: boolean }) {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch("/api/account/prefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Voorkeuren</h2>
      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={notif}
          onChange={(e) => {
            setNotif(e.target.checked);
            void persist({ notificationsEnabled: e.target.checked });
          }}
          className="mt-1 h-4 w-4"
        />
        <span className="text-sm text-slate-700">
          <strong>E-mail meldingen</strong> — maandelijkse markt-recheck + re-engagement mails.
        </span>
      </label>
      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          data-testid="ocr-optin"
          checked={optIn}
          onChange={(e) => {
            setOptIn(e.target.checked);
            void persist({ ocrTrainingOptIn: e.target.checked });
          }}
          className="mt-1 h-4 w-4"
        />
        <span className="text-sm text-slate-700">
          <strong>AI-verbetering</strong> — mag DeGeldHeld mijn <em>geanonimiseerde</em>
          facturen gebruiken om de OCR te verbeteren? (Geen namen / IBAN / adres opgeslagen.)
        </span>
      </label>
      <div className="mt-2 h-4 text-xs text-emerald-700">
        {saving ? "Opslaan…" : saved ? "✓ Opgeslagen" : ""}
      </div>
    </section>
  );
}

function DeleteForm() {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: phrase }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        setError(data.error ?? "Onbekende fout");
        setPending(false);
        return;
      }
      router.push("/");
    } catch {
      setError("Netwerkfout");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm text-rose-900">
        Type <code className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs">VERWIJDER MIJN ACCOUNT</code> om te bevestigen:
      </label>
      <input
        type="text"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        data-testid="delete-confirm"
        className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-mono"
        placeholder="VERWIJDER MIJN ACCOUNT"
      />
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={pending || phrase !== "VERWIJDER MIJN ACCOUNT"}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
      >
        {pending ? "Verwijderen…" : "Verwijder account permanent"}
      </button>
    </form>
  );
}

AccountControls.DeleteForm = DeleteForm;
export default AccountControls;
