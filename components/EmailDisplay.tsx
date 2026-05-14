"use client";

import { useState } from "react";
import { formatEurCents, formatPercent } from "@/lib/format";

export default function EmailDisplay({
  subject,
  body,
  reasoning,
  expectedSavingsCents,
  confidence,
}: {
  subject: string;
  body: string;
  reasoning: string;
  expectedSavingsCents: number;
  confidence: number;
}) {
  const [copied, setCopied] = useState(false);
  async function copyAll() {
    const text = `Onderwerp: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — fallback handled by browser select-text
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="text-sm font-medium text-brand-700">Verwachte jaarlijkse besparing</div>
        <div className="mt-1 text-2xl font-bold text-brand-700">
          {formatEurCents(expectedSavingsCents, { showDecimals: false })}
        </div>
        <div className="mt-1 text-xs text-brand-700">
          Vertrouwen: {formatPercent(confidence)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Onderwerp
        </div>
        <div className="text-lg font-semibold text-slate-900">{subject}</div>
        <hr className="my-4" />
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Bericht
        </div>
        <pre className="whitespace-pre-wrap font-sans text-slate-800">{body}</pre>
      </div>

      <button
        type="button"
        onClick={copyAll}
        className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
      >
        {copied ? "✓ Gekopieerd" : "Kopieer onderwerp + bericht"}
      </button>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Waarom werkt deze hoek? (uitleg)
        </summary>
        <p className="mt-3 text-sm text-slate-600">{reasoning}</p>
      </details>
    </div>
  );
}
