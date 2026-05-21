"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

const GENERIC_SEND_ERROR =
  "Er ging iets mis bij het versturen. Probeer het zo opnieuw.";

/** Map a NextAuth / send-gate error code to a Dutch, user-facing message. */
function mapAuthError(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "rate_limited":
      return "Te veel inlogpogingen vanaf dit netwerk. Wacht een uur en probeer het dan opnieuw.";
    case "blocked":
      return "Dit verzoek werd geblokkeerd. Gebruik een gewone browser of app en probeer het opnieuw.";
    default:
      return GENERIC_SEND_ERROR;
  }
}

function LoginForm() {
  const params = useSearchParams();
  const checkEmail = params?.get("check") === "email";
  // Honor a same-site callbackUrl (e.g. an anonymous visitor continuing to
  // their bill's onderhandel-mail after signup). Only accept a single-slash
  // relative path to avoid an open redirect; default to the dashboard.
  const rawCallback = params?.get("callbackUrl") ?? "";
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/dashboard";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    mapAuthError(params?.get("error")),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // redirect:false so we can surface a clear inline error — the send is
      // rate-limited / bot-gated server-side in the resend route handler,
      // which returns { url: "/login?error=…" } for next-auth/react to read.
      const res = await signIn<"email">("resend", {
        email,
        callbackUrl,
        redirect: false,
      });
      if (res?.ok && !res.error) {
        setSent(true);
      } else {
        setError(mapAuthError(res?.error) ?? GENERIC_SEND_ERROR);
      }
    } catch {
      setError("Netwerkfout — controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
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
        {checkEmail || sent ? (
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
            {error && (
              <p
                role="alert"
                className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
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
