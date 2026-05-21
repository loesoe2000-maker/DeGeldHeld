"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginForm() {
  const params = useSearchParams();
  const checkEmail = params?.get("check") === "email";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("resend", { email, callbackUrl: "/dashboard" });
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Inloggen of gratis account maken
        </h1>
        <p className="mb-6 text-slate-600">
          Vul je e-mail in — bestaand of nieuw. We sturen je een inloglink en
          maken automatisch een <strong>gratis account</strong> aan als je nieuw
          bent. Geen wachtwoord nodig.
        </p>
        {checkEmail ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-medium text-emerald-800">Check je inbox 📬</p>
            <p className="mt-1 text-sm text-emerald-700">
              We hebben je een inloglink gestuurd. Kijk ook even in je spam.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Geen mail binnen 2 minuten? <strong>School- of werkmail blokkeert
              de link vaak</strong> — gebruik dan een persoonlijk adres
              (Gmail, iCloud, Outlook).
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
              E-mailadres
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jouw@email.nl"
              autoComplete="email"
              className="w-full rounded border p-3"
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] w-full rounded bg-brand-700 p-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Versturen..." : "Stuur me een inloglink"}
            </button>
            <p className="text-xs text-slate-500">
              Tip: gebruik een persoonlijk e-mailadres — school- en werkmail
              blokkeren onze inloglink soms.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8">Laden...</div>}>
      <LoginForm />
    </Suspense>
  );
}
