export const dynamic = 'force-dynamic';
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const params = useSearchParams();
  const checkEmail = params?.get("check") === "email";
  const from = params?.get("from") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await signIn("resend", { email, redirect: false, callbackUrl: from });
      if (res?.error) {
        setStatus("error");
        setError("Verzenden mislukt. Probeer opnieuw.");
      } else {
        setStatus("sent");
      }
    } catch {
      setStatus("error");
      setError("Netwerkfout — probeer opnieuw.");
    }
  }

  if (checkEmail || status === "sent") {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-brand-700">Check je e-mail 📨</h1>
        <p className="mt-4 text-slate-600">
          We hebben je een magic link gestuurd. Klik erop om in te loggen.
        </p>
        <p className="mt-2 text-xs text-slate-400">De link is 10 minuten geldig.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-bold text-slate-900">Inloggen</h1>
      <p className="mt-2 text-slate-600">
        Geef je e-mail — we sturen je een veilige inlog-link (geen wachtwoord nodig).
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            E-mailadres
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {status === "loading" ? "Versturen…" : "Stuur magic link"}
        </button>
        {status === "error" && (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        )}
      </form>
    </main>
  );
}
