"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KIND_HINT,
  type DocumentKind,
} from "@/lib/user-documents";

/**
 * v36 idee 4 — client-form voor document-upload. Eén kind-selector, één
 * file-input, optionele note. POST naar /api/account/documents/upload met
 * multipart/form-data; bij succes refresh'en we de server-page zodat de
 * lijst gevuld wordt.
 */
export default function DocumentUploadForm() {
  const [kind, setKind] = useState<DocumentKind>("aangifte");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Kies eerst een bestand.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (note.trim().length > 0) fd.append("note", note.trim());

    const res = await fetch("/api/account/documents/upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "Upload mislukt." }))) as {
        error?: string;
      };
      setError(body.error ?? "Upload mislukt.");
      return;
    }
    // v37 — eerlijke fallback: faalt of vertraagt de refresh (Neon cold-start),
    // dan weet de gebruiker dat de upload tóch gelukt is en wat te doen.
    setSuccess(
      "Document opgeslagen. Staat 'ie hieronder nog niet in de lijst? Ververs dan de pagina.",
    );
    if (fileRef.current) fileRef.current.value = "";
    setNote("");
    startTransition(() => router.refresh());
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="document-upload-form"
      className="mt-3 grid gap-3"
    >
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Categorie</span>
        <select
          data-testid="document-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as DocumentKind)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {DOCUMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {DOCUMENT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          {DOCUMENT_KIND_HINT[kind]}
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-slate-700">Bestand (PDF, JPG of PNG · max 10 MB)</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          data-testid="document-file"
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-slate-700">
          Toelichting (optioneel)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder='bv. "Definitieve aangifte 2024"'
          data-testid="document-note"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </label>

      {error ? (
        <p data-testid="document-upload-error" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          data-testid="document-upload-success"
          className="text-sm text-emerald-700"
        >
          {success}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          data-testid="document-upload-submit"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {isPending ? "Bezig…" : "Upload document"}
        </button>
      </div>
    </form>
  );
}
