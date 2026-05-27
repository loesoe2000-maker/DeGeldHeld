"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  volmachtMandateText,
  type VolmachtClaimType,
} from "@/lib/volmacht";

type Props = {
  claimType: VolmachtClaimType;
  claimId: string;
  defaultFullName?: string;
};

/**
 * v36 idee 2 — SES sign-form. Live preview van de mandaat-tekst zodra user
 * z'n naam typt, expliciete bevestiging-checkbox, en bij submit POST naar
 * /api/volmacht/[claimType]/[claimId]/sign met fullName + acceptedText.
 *
 * De acceptedText wordt op de server vergeleken met de huidige template-
 * versie. Mismatch (bv. user op oudere pagina) → 400.
 */
export default function VolmachtSignForm({
  claimType,
  claimId,
  defaultFullName,
}: Props) {
  const [fullName, setFullName] = useState(defaultFullName ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const naam = fullName.trim();
  const isNaamValid = naam.length >= 5 && /\s/.test(naam) && naam.length <= 100;
  const mandateText = useMemo(
    () => volmachtMandateText(claimType, isNaamValid ? naam : "[je volledige naam]"),
    [claimType, naam, isNaamValid],
  );
  const canSubmit = isNaamValid && confirmed && !isPending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    const res = await fetch(
      `/api/volmacht/${claimType}/${encodeURIComponent(claimId)}/sign`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: naam,
          acceptedText: volmachtMandateText(claimType, naam),
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: "Ondertekenen mislukt." }))) as {
        error?: string;
      };
      setError(body.error ?? "Ondertekenen mislukt.");
      return;
    }
    setSuccess(true);
    startTransition(() => router.refresh());
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="volmacht-form"
      className="rounded-2xl border border-brand-200 bg-brand-50/40 p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">Ondertekenen</h2>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-slate-700">Volledige naam</span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={100}
          data-testid="volmacht-fullname"
          autoComplete="name"
          placeholder="bv. Anna van Houten"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Voer je voor- én achternaam in zoals op je ID. We slaan deze op samen
          met een datum-stempel als bewijs van je instemming.
        </span>
      </label>

      <details
        data-testid="volmacht-mandate-preview"
        className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm"
      >
        <summary className="cursor-pointer font-semibold text-slate-700">
          Bekijk de exacte mandaat-tekst
        </summary>
        <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">
          {mandateText}
        </p>
      </details>

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          data-testid="volmacht-confirm"
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-slate-700">
          Ik bevestig dat ik de volmacht-tekst hierboven heb gelezen en
          begrepen, en geef DeGeldHeld toestemming om namens mij te handelen
          binnen de daarin genoemde grenzen. Ik begrijp dat ik de volmacht op
          elk moment kan intrekken via hallo@degeldheld.com.
        </span>
      </label>

      {error ? (
        <p data-testid="volmacht-error" className="mt-4 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          data-testid="volmacht-success"
          className="mt-4 text-sm font-semibold text-emerald-700"
        >
          Volmacht ondertekend en opgeslagen.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        data-testid="volmacht-submit"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Bezig…" : "Onderteken volmacht"}
      </button>
    </form>
  );
}
