"use client";

import { useState } from "react";

const CATEGORIES = [
  "TELECOM",
  "ENERGIE",
  "VERZEKERING",
  "HYPOTHEEK",
  "BANK",
  "ABONNEMENT",
  "OVERIG",
];
const COUNTRIES = ["NL", "BE", "DE", "FR", "UK", "US", "ES", "IT"];

export default function SeedSuccessForm() {
  const [provider, setProvider] = useState("KPN");
  const [category, setCategory] = useState("TELECOM");
  const [country, setCountry] = useState("NL");
  const [beforeEur, setBeforeEur] = useState("42");
  const [afterEur, setAfterEur] = useState("32");
  const [customerYears, setCustomerYears] = useState("3");
  const [daysAgo, setDaysAgo] = useState("30");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/seed-success", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          category,
          country,
          beforeMonthlyCents: Math.round(Number(beforeEur) * 100),
          afterMonthlyCents: Math.round(Number(afterEur) * 100),
          customerYears: Number(customerYears),
          daysAgo: Number(daysAgo),
          note: note || undefined,
        }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; yearlySavingCents?: number };
      if (!r.ok || !data.ok) {
        setResult({ ok: false, message: data.error ?? "Onbekende fout" });
      } else {
        setResult({
          ok: true,
          message: `Toegevoegd. Jaarbesparing: €${((data.yearlySavingCents ?? 0) / 100).toFixed(0)}. Refresh /proof.`,
        });
        // Reset alleen note + amounts
        setNote("");
      }
    } catch (e) {
      setResult({
        ok: false,
        message: e instanceof Error ? e.message : "Netwerkfout",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <Row>
        <Field label="Provider">
          <input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            required
            placeholder="KPN"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Categorie">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <Row>
        <Field label="Land">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Klant sinds (jaren)">
          <input
            type="number"
            min={0}
            max={50}
            value={customerYears}
            onChange={(e) => setCustomerYears(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </Row>

      <Row>
        <Field label="Vorig maandbedrag (€)">
          <input
            type="number"
            min={1}
            step="0.01"
            value={beforeEur}
            onChange={(e) => setBeforeEur(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Nieuw maandbedrag (€)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={afterEur}
            onChange={(e) => setAfterEur(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </Row>

      <Field label="Wanneer (dagen geleden)">
        <input
          type="number"
          min={0}
          max={365}
          value={daysAgo}
          onChange={(e) => setDaysAgo(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Notitie (optioneel, intern)">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="bv 'KPN retentie matched Budget Mobiel aanbod'"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      {beforeEur && afterEur && Number(afterEur) < Number(beforeEur) && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Bespaart: <strong>€{((Number(beforeEur) - Number(afterEur)) * 12).toFixed(0)}/jaar</strong>{" "}
          (€{(Number(beforeEur) - Number(afterEur)).toFixed(2)}/mnd)
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Toevoegen…" : "Voeg toe aan /proof"}
      </button>

      {result && (
        <div
          className={`rounded-lg p-3 text-sm ${
            result.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
          }`}
        >
          {result.message}
        </div>
      )}
    </form>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-600">{label}</div>
      {children}
    </label>
  );
}
