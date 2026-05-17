"use client";

import { useState } from "react";

export default function Hero() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "hero" }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
        setMessage("Bedankt — je staat op de lijst.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Er ging iets mis.");
      }
    } catch {
      setStatus("error");
      setMessage("Netwerkfout — probeer opnieuw.");
    }
  }

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Houd je geld in <span className="text-brand-600">eigen zak</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
          Upload je telefoon-, internet- of energierekening. DeGeldHeld
          onderhandelt automatisch met je provider en je betaalt alleen
          <strong> 15% van wat we besparen</strong>.
        </p>

        <form onSubmit={submit} className="mx-auto mt-10 flex max-w-md flex-col gap-2 sm:flex-row">
          <label htmlFor="email" className="sr-only">E-mailadres</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jouw@email.nl"
            className="w-full flex-1 rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            aria-label="E-mailadres voor wachtlijst"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {status === "loading" ? "Even geduld…" : "Word lid"}
          </button>
        </form>

        {status === "ok" && (
          <p role="status" className="mt-4 text-brand-700">{message}</p>
        )}
        {status === "error" && (
          <p role="alert" className="mt-4 text-red-600">{message}</p>
        )}

        <p className="mt-6 text-sm text-slate-500">
          Geen kosten vooraf · Niet bespaard? Niets te betalen · NL providers ondersteund
        </p>
        <p className="mt-4">
          <a
            href="/demo"
            className="text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800"
          >
            Bekijk hoe het werkt (30 sec) →
          </a>
        </p>
      </div>
    </section>
  );
}
