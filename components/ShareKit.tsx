"use client";

import { useState } from "react";

export default function ShareKit({
  savedYearlyEur,
  provider,
  referralCode,
}: {
  savedYearlyEur: number;
  provider: string;
  referralCode?: string;
}) {
  const referBase = referralCode ? `https://degeldheld.com/uitnodiging/${referralCode}` : "https://degeldheld.com";
  const baseUtm = "?utm_source=share";
  const wa = `${referBase}${baseUtm}&utm_medium=whatsapp`;
  const x  = `${referBase}${baseUtm}&utm_medium=x`;
  const li = `${referBase}${baseUtm}&utm_medium=linkedin`;
  const ig = `${referBase}${baseUtm}&utm_medium=instagram`;

  const defaultText = `Ik bespaarde €${savedYearlyEur} bij ${provider} dankzij DeGeldHeld AI 🎉`;
  const [text, setText] = useState(defaultText);

  const waLink = `https://wa.me/?text=${encodeURIComponent(`${text} ${wa}`)}`;
  const xLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${x}`)}`;
  const liLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(li)}`;
  const igStoryPng = `/api/og/share?saved=${savedYearlyEur}&provider=${encodeURIComponent(provider)}`;

  return (
    <div data-testid="share-kit" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
      <h2 className="text-xl font-bold text-emerald-900">Deel je succes</h2>
      <p className="mt-1 text-sm text-emerald-800">
        Anderen helpen besparen + jij verdient gratis onderhandelingen via je referral.
      </p>

      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-emerald-900">
        Tekst
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white p-3 text-sm text-slate-800"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          WhatsApp
        </a>
        <a
          href={xLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          X / Twitter
        </a>
        <a
          href={liLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          LinkedIn
        </a>
        <a
          href={igStoryPng}
          target="_blank"
          rel="noopener noreferrer"
          download={`degeldheld-${provider}.png`}
          className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-700"
        >
          Instagram Story (PNG)
        </a>
      </div>
    </div>
  );
}
