"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VolmachtClaimType } from "@/lib/volmacht";

type Props = {
  claimType: VolmachtClaimType;
  claimId: string;
  alreadyUploaded: boolean;
  signedDocumentFilename: string | null;
  signedDocumentUploadedAt: Date | null;
};

/**
 * v36 idee 2 — papier-volmacht client-flow.
 *
 * 3 stappen:
 *  (1) Download het voorgevulde PDF-machtigingsformulier
 *  (2) Print + onderteken met de hand + scan/foto
 *  (3) Upload de getekende scan terug
 *
 * Bij upload wordt server-side een Volmacht-row aangemaakt of geüpdate.
 * De bestaande blob-URL verlaat onze server nooit — download via auth-
 * gated proxy.
 */
export default function VolmachtPaperFlow({
  claimType,
  claimId,
  alreadyUploaded,
  signedDocumentFilename,
  signedDocumentUploadedAt,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const downloadHref = `/api/volmacht/${claimType}/${encodeURIComponent(claimId)}/form`;
  const signedFileHref = `/api/volmacht/${claimType}/${encodeURIComponent(claimId)}/signed-file`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Kies eerst de gescande/getekende volmacht.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(
      `/api/volmacht/${claimType}/${encodeURIComponent(claimId)}/upload-signed`,
      {
        method: "POST",
        body: fd,
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "Upload mislukt." }))) as {
        error?: string;
      };
      setError(body.error ?? "Upload mislukt.");
      return;
    }
    setSuccess(true);
    if (fileRef.current) fileRef.current.value = "";
    startTransition(() => router.refresh());
  }

  if (alreadyUploaded) {
    return (
      <section
        data-testid="volmacht-paper-uploaded"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6"
      >
        <h2 className="text-lg font-semibold text-emerald-900">
          Getekend volmacht-formulier ontvangen
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          {signedDocumentUploadedAt
            ? `Geüpload op ${signedDocumentUploadedAt.toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}.`
            : "Volmacht is in behandeling."}
          {signedDocumentFilename ? ` Bestand: ${signedDocumentFilename}.` : ""}
        </p>
        <p className="mt-3 text-sm">
          <a
            href={signedFileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-700 underline hover:text-brand-800"
          >
            Bekijk geüploade volmacht →
          </a>
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stap 1 — download */}
      <section
        data-testid="volmacht-step-download"
        className="rounded-2xl border border-brand-200 bg-brand-50/40 p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          1. Download het machtigingsformulier
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          We hebben je gegevens, de zaak-identifier en de scope-beperkingen
          alvast voor je ingevuld. Open de PDF en print 'm uit.
        </p>
        <a
          href={downloadHref}
          download
          data-testid="volmacht-download-form"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Download machtigings-PDF
        </a>
      </section>

      {/* Stap 2 — print + tekenen */}
      <section
        data-testid="volmacht-step-sign"
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          2. Print, lees en onderteken met de hand
        </h2>
        <ol className="mt-3 list-decimal pl-5 text-sm text-slate-700">
          <li>Print de PDF op een gewoon vel A4.</li>
          <li>
            Lees de tekst zorgvuldig — verandert er iets in jouw situatie of
            klopt iets niet, neem dan contact op via{" "}
            <a className="underline" href="mailto:hallo@degeldheld.com">
              hallo@degeldheld.com
            </a>
            .
          </li>
          <li>Vul plaats + datum in en zet je handtekening eronder.</li>
          <li>Scan de getekende pagina, óf maak een scherpe foto met je telefoon.</li>
        </ol>
      </section>

      {/* Stap 3 — upload */}
      <section
        data-testid="volmacht-step-upload"
        className="rounded-2xl border border-brand-200 bg-brand-50/40 p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          3. Upload de getekende scan/foto
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          PDF, JPG of PNG · max 10 MB. Wij gebruiken 'm uitsluitend voor deze
          procedure en bewaren 'm achter een privé-gate.
        </p>

        <form
          onSubmit={onSubmit}
          data-testid="volmacht-upload-form"
          className="mt-4 grid gap-3"
        >
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Getekende volmacht</span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              data-testid="volmacht-upload-file"
              className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
            />
          </label>

          {error ? (
            <p
              data-testid="volmacht-upload-error"
              className="text-sm text-rose-700"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              data-testid="volmacht-upload-success"
              className="text-sm font-semibold text-emerald-700"
            >
              Volmacht ontvangen — we kunnen nu namens jou starten.
            </p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={isPending}
              data-testid="volmacht-upload-submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {isPending ? "Bezig…" : "Upload getekende volmacht"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
