"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoundForm({ negotiationId }: { negotiationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim() && !file) {
      setError("Plak het antwoord of upload een screenshot.");
      return;
    }
    setPending(true);
    try {
      const form = new FormData();
      form.set("negotiationId", negotiationId);
      if (text.trim()) form.set("providerResponse", text.trim());
      if (file) form.set("screenshot", file);

      const resp = await fetch("/api/negotiations/round", { method: "POST", body: form });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        setError(data.error ?? "Er ging iets mis");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Netwerkfout — probeer opnieuw");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="provider-response" className="text-sm font-medium text-slate-700">
          Plak het antwoord van de provider
        </label>
        <textarea
          id="provider-response"
          name="providerResponse"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Plak hier de complete mail die je van je provider terugkreeg…"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="text-center text-xs text-slate-500">— of —</div>
      <div>
        <label htmlFor="provider-screenshot" className="text-sm font-medium text-slate-700">
          Upload een screenshot
        </label>
        <input
          id="provider-screenshot"
          name="screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Analyseren…" : "Analyseer antwoord"}
      </button>
    </form>
  );
}
