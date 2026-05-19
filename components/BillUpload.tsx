"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

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

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
  }
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "application/pdf"];
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function validateClientFile(file: File): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: "Bestand is leeg" };
  if (file.size > MAX_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, error: `Bestand is ${mb} MB — maximum is 10 MB` };
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    return { ok: false, error: "Alleen JPG, PNG, WebP, HEIC of PDF" };
  }
  return { ok: true };
}

export default function BillUpload({ onUploaded }: { onUploaded?: (r: UploadResp) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [progress, setProgress] = useState<"validating" | "uploading" | "analysing" | "">("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);

  // Render Turnstile-widget zodra het script geladen is en de site-key
  // beschikbaar is. Zonder site-key: skip widget (server doet graceful fallback).
  useEffect(() => {
    if (!SITE_KEY) {
      setTurnstileReady(true); // doe alsof het klaar is — server skipt verificatie
      return;
    }
    function tryRender() {
      if (!window.turnstile || !turnstileRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => {
          setTurnstileToken(token);
          setTurnstileReady(true);
        },
        "expired-callback": () => {
          setTurnstileToken(null);
        },
        "error-callback": () => {
          setTurnstileToken(null);
        },
        theme: "light",
        appearance: "always",
      });
    }
    // Poll voor maximaal 5s tot turnstile globaal beschikbaar is
    const interval = setInterval(() => {
      if (window.turnstile) {
        tryRender();
        clearInterval(interval);
      }
    }, 100);
    const timeout = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const submit = useCallback(
    async (file: File) => {
      setError("");
      setSelectedName(file.name);
      setProgress("validating");
      const v = validateClientFile(file);
      if (!v.ok) {
        setError(v.error);
        setProgress("");
        return;
      }
      // Als Turnstile actief is en geen token: vraag verifiëren
      if (SITE_KEY && !turnstileToken) {
        setError("Wacht even tot de bot-controle klaar is, of vink de checkbox aan.");
        setProgress("");
        return;
      }
      setBusy(true);
      setProgress("uploading");
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (turnstileToken) fd.append("turnstileToken", turnstileToken);
        let res = await fetch("/api/bills/upload", { method: "POST", body: fd });
        if (res.status >= 500 && res.status < 600) {
          await new Promise((r) => setTimeout(r, 800));
          setProgress("analysing");
          res = await fetch("/api/bills/upload", { method: "POST", body: fd });
        }

        const ct = res.headers.get("content-type") ?? "";
        const isJson = ct.includes("application/json");
        const bodyText = await res.text();

        if (!isJson) {
          if (res.status === 504) {
            setError("Analyse duurde te lang — probeer een kleinere afbeelding.");
          } else if (res.status === 413) {
            setError("Bestand te groot voor server. Probeer < 4 MB.");
          } else if (res.status === 401 || res.status === 403) {
            setError("Je sessie is verlopen — log opnieuw in.");
          } else if (res.status === 429) {
            setError("Even rustig — je hebt veel uploads in korte tijd. Probeer over 1 uur opnieuw.");
          } else {
            setError(`Server gaf onverwacht antwoord (${res.status}). Probeer opnieuw.`);
          }
          return;
        }

        if (res.status === 429) {
          setError("Even rustig — je hebt veel uploads in korte tijd. Probeer over 1 uur opnieuw.");
          return;
        }

        const data: UploadResp = JSON.parse(bodyText);
        if (!res.ok) {
          setError(data.error ?? "Upload mislukt — probeer opnieuw");
          // Bot-controle gefaald → reset Turnstile-widget voor nieuwe poging
          if (data.error?.includes("Bot-controle") && widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
            setTurnstileToken(null);
          }
        } else {
          onUploaded?.(data);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        setError(
          msg.includes("Failed to fetch") || msg.includes("NetworkError")
            ? "Netwerkfout — controleer je verbinding en probeer opnieuw"
            : `Upload mislukt: ${msg || "onbekende fout"}`,
        );
      } finally {
        setBusy(false);
        setProgress("");
      }
    },
    [onUploaded, turnstileToken],
  );

  const progressLabel = {
    validating: "Bestand controleren…",
    uploading: "Uploaden…",
    analysing: "Rekening uitlezen…",
    "": "",
  }[progress];

  return (
    <div>
      {SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          async
          defer
        />
      )}

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
        <div className="mt-1 text-sm text-slate-500">JPG, PNG, WebP, HEIC of PDF · max 10 MB</div>
        <input
          ref={inputRef}
          id="bill-file"
          type="file"
          accept="image/*,application/pdf,.heic"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) submit(f);
          }}
        />
      </label>

      {SITE_KEY && (
        <div className="mt-4 flex justify-center">
          <div ref={turnstileRef} className="cf-turnstile" />
        </div>
      )}

      {selectedName && !error && (
        <p className="mt-3 text-center text-sm text-slate-600">
          Geselecteerd: <span className="font-medium">{selectedName}</span>
        </p>
      )}

      {busy && (
        <p role="status" className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" aria-hidden />
          {progressLabel}
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
