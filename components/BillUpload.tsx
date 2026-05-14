"use client";

import { useCallback, useRef, useState } from "react";

type UploadResp = {
  ok: boolean;
  billId?: string;
  needsManual?: boolean;
  cached?: boolean;
  error?: string;
  extracted?: {
    provider: string | null;
    category: string | null;
    amountCents: number | null;
    plan: string | null;
    period: string | null;
    confidence: number;
  };
};

export default function BillUpload({ onUploaded }: { onUploaded?: (r: UploadResp) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(
    async (file: File) => {
      setError("");
      if (file.size > 10 * 1024 * 1024) {
        setError("Bestand mag max 10 MB zijn");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("Alleen afbeeldingen (JPG/PNG/WebP/HEIC)");
        return;
      }
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/bills/upload", { method: "POST", body: fd });
        const data: UploadResp = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Upload mislukt");
        } else {
          onUploaded?.(data);
        }
      } catch {
        setError("Netwerkfout — probeer opnieuw");
      } finally {
        setBusy(false);
      }
    },
    [onUploaded],
  );

  return (
    <div>
      <label
        htmlFor="bill-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) submit(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition ${
          dragOver
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-slate-50 hover:bg-brand-50"
        }`}
      >
        <div className="text-4xl" aria-hidden>
          📄
        </div>
        <div className="mt-4 text-lg font-semibold text-slate-900">
          Sleep je rekening hierheen of klik om te kiezen
        </div>
        <div className="mt-1 text-sm text-slate-500">JPG, PNG, WebP, HEIC · max 10 MB</div>
        <input
          ref={inputRef}
          id="bill-file"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) submit(f);
          }}
        />
      </label>

      {busy && (
        <p role="status" className="mt-4 text-center text-sm text-slate-600">
          Bezig met uploaden en analyseren…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
