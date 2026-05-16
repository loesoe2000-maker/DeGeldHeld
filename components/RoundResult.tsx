"use client";

import { useState } from "react";
import { buildWhatsAppShareUrl } from "@/lib/negotiator";
import type { RoundAnalysis } from "@/lib/rounds";

export default function RoundResult({
  analysis,
  counterSubject,
  counterBody,
  outcome,
}: {
  analysis: RoundAnalysis;
  counterSubject: string | null;
  counterBody: string | null;
  outcome: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    if (!counterSubject || !counterBody) return;
    const text = `Onderwerp: ${counterSubject}\n\n${counterBody}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* select-text fallback */
    }
  }

  const offeredEur =
    analysis.offeredCents != null
      ? `€${(analysis.offeredCents / 100).toFixed(2).replace(".", ",")}`
      : "geen bedrag";

  const toneColor =
    analysis.tone === "constructief"
      ? "bg-emerald-100 text-emerald-800"
      : analysis.tone === "afwijzend"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";

  const actionLabel: Record<typeof analysis.action, string> = {
    accept: "Akkoord — sluit de deal",
    counter: "Verstuur counter-mail",
    escalate: "Escaleer naar senior",
    walk_away: "Stop hier — overstap",
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Onze analyse</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            Biedt: {offeredEur}
          </span>
          {analysis.discountPct != null && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              Korting: {Math.round(analysis.discountPct)}%
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneColor}`}>
            Tone: {analysis.tone}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            Advies: {actionLabel[analysis.action]}
          </span>
        </div>
        {analysis.reasoning && (
          <p className="mt-3 text-sm text-slate-600">{analysis.reasoning}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">Status: {outcome}</p>
      </section>

      {counterSubject && counterBody && (
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-base font-semibold text-brand-900">Counter-mail</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <span className="font-medium text-slate-700">Onderwerp:</span>{" "}
              <span className="text-slate-900">{counterSubject}</span>
            </div>
            <pre className="whitespace-pre-wrap rounded-md border border-brand-100 bg-white p-3 font-sans text-slate-800">
              {counterBody}
            </pre>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyAll}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {copied ? "Gekopieerd ✓" : "Kopieer onderwerp + bericht"}
            </button>
            <a
              href={buildWhatsAppShareUrl({ subject: counterSubject, body: counterBody })}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-brand-300 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Deel via WhatsApp
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
