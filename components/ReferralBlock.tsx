"use client";

import { useState } from "react";

export default function ReferralBlock({ url, count }: { url: string; count: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }
  const text = `Ik bespaarde geld via DeGeldHeld. Jij eerste onderhandeling gratis: ${url}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const mailto = `mailto:?subject=${encodeURIComponent("DeGeldHeld uitnodiging")}&body=${encodeURIComponent(text)}`;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <code
          data-testid="referral-url"
          className="flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-700"
        >
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {copied ? "✓ Gekopieerd" : "Kopieer link"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          Deel via WhatsApp
        </a>
        <a
          href={mailto}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Deel via e-mail
        </a>
        <span className="ml-auto text-sm text-slate-600">
          <strong>{count}</strong> {count === 1 ? "persoon" : "mensen"} via jou aangesloten
        </span>
      </div>
    </div>
  );
}
