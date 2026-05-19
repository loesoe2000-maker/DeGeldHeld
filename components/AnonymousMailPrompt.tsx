"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

/**
 * v15 DEEL 2 — email-prompt CTA shown on /onderhandel/analyse when
 * the visitor has no session. Submits email → server triggers a
 * NextAuth magic-link with the bill-id embedded so the visitor
 * lands back at /onderhandel/email after signup.
 */
export default function AnonymousMailPrompt({
  billId,
  provider,
  yearlySavingsCents,
}: {
  billId: string;
  provider: string;
  yearlySavingsCents: number;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // v15 DEEL 5 honeypot — bots fill in every input they see.
  const [hp, setHp] = useState("");
  // v15 DEEL 5 time-gate — bots usually submit < 2s. We stamp the
  // render time and require ≥2s before accepting.
  const [renderedAt] = useState<number>(() => Date.now());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (hp.length > 0) {
      // Silent reject for bots.
      setSent(true);
      return;
    }
    if (Date.now() - renderedAt < 2000) {
      setError("Even rustig — wacht een seconde en probeer opnieuw.");
      return;
    }
    if (!email.includes("@") || email.length < 5) {
      setError("Vul een geldig e-mailadres in.");
      return;
    }
    setSubmitting(true);
    try {
      // Server-side anti-bot gate runs first (validates honeypot/
      // time-gate/email shape + rate-limit per IP). On success the
      // browser hands the email off to NextAuth so the magic-link
      // is generated through the standard Resend provider machinery.
      const resp = await fetch("/api/anon/email-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          billId,
          hp,
          renderedAt,
        }),
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        setError(data.error ?? "Er ging iets mis — probeer opnieuw.");
        setSubmitting(false);
        return;
      }
      await signIn("resend", {
        email,
        callbackUrl: `/onderhandel/email?bill=${billId}`,
        redirect: false,
      });
      setSent(true);
    } catch {
      setError("Netwerkfout — probeer opnieuw.");
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <section
        data-testid="anon-mail-sent"
        className="mt-10 rounded-xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <h2 className="text-lg font-semibold text-emerald-900">
          📬 Check je inbox
        </h2>
        <p className="mt-2 text-sm text-emerald-900">
          We hebben je een mail gestuurd. Klik op de link en je
          onderhandel-mail voor <strong>{provider}</strong> staat klaar.
        </p>
      </section>
    );
  }

  const savingsEur = Math.max(0, Math.round(yearlySavingsCents / 100));

  return (
    <section
      data-testid="anon-mail-prompt"
      className="mt-10 rounded-2xl border-2 border-brand-300 bg-brand-50 p-6"
    >
      <h2 className="text-xl font-bold text-brand-900">
        💰 Je kunt €{savingsEur}/jaar besparen bij {provider}
      </h2>
      <p className="mt-2 text-sm text-brand-900">
        We genereren je persoonlijke onderhandel-mail. Schrijf in met
        je e-mailadres — we sturen 'm direct toe.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          placeholder="je@email.nl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-base"
          autoComplete="email"
          data-testid="anon-email-input"
        />
        {/* Honeypot: visually hidden, real users won't fill it. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          style={{
            position: "absolute",
            left: "-9999px",
            width: 1,
            height: 1,
            opacity: 0,
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          data-testid="anon-submit"
        >
          {submitting ? "Even geduld…" : "Stuur de mail →"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-brand-900/70">
        Geen wachtwoord, geen spam. Eerste 3 onderhandelingen gratis.
      </p>
    </section>
  );
}
