"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Choice = "SUCCESS_SAVED" | "STILL_WAITING" | "FAILED_NO_DEAL";
type ProofStep = "ask" | "upload" | "skipped" | "verified" | "rejected";

export default function OutcomeForm({
  negotiationId,
  currentMonthlyCents,
}: {
  negotiationId: string;
  currentMonthlyCents: number;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [providerResponded, setProviderResponded] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [proofStep, setProofStep] = useState<ProofStep | null>(null);
  const [proofResult, setProofResult] = useState<string | null>(null);

  async function postFeedback(payload: Record<string, unknown>) {
    void fetch(`/api/negotiations/${negotiationId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  async function submit(c: Choice, body: Record<string, unknown> = {}) {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/negotiations/outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId, outcome: c, ...body }),
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        setError(data.error ?? "Er ging iets mis");
        setPending(false);
        return;
      }
      // SUCCESS_SAVED: ask for proof before treating it as done.
      if (c === "SUCCESS_SAVED") {
        setProofStep("ask");
        setPending(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.refresh(), 800);
    } catch {
      setError("Netwerkfout — probeer opnieuw");
      setPending(false);
    }
  }

  async function uploadProof(file: File) {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const resp = await fetch(`/api/outcome/${negotiationId}/proof`, {
        method: "POST",
        body: fd,
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        verdict?: { verdict: string; reason?: string };
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error ?? "Upload mislukt");
        setPending(false);
        return;
      }
      if (data.verdict?.verdict === "verified") {
        setProofStep("verified");
        setProofResult("Bewijs geverifieerd — je besparing telt nu mee voor /proof.");
      } else {
        setProofStep("rejected");
        setProofResult(data.verdict?.reason ?? "Bewijs niet herkend.");
      }
      setPending(false);
      setTimeout(() => router.refresh(), 1500);
    } catch {
      setError("Netwerkfout bij upload — probeer opnieuw");
      setPending(false);
    }
  }

  function skipProof() {
    setProofStep("skipped");
    setProofResult(
      "Claim niet geverifieerd — je besparing telt niet mee voor /proof en er wordt geen fee in rekening gebracht.",
    );
    setDone(true);
    setTimeout(() => router.refresh(), 1500);
  }

  function submitSuccess(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = newAmount.replace(/[€\s]/g, "").replace(",", ".");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0 || n >= currentMonthlyCents / 100) {
      setError(`Bedrag moet kleiner zijn dan €${(currentMonthlyCents / 100).toFixed(2).replace(".", ",")}`);
      return;
    }
    const newCents = Math.round(n * 100);
    const savedCents = currentMonthlyCents - newCents;
    void postFeedback({ providerResponded });
    submit("SUCCESS_SAVED", { actualSavingsCents: savedCents });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <h2 className="text-xl font-semibold text-emerald-900">Dank je!</h2>
        <p className="mt-2 text-sm text-emerald-800">
          {proofResult ?? "Je bijdrage staat nu in onze Track Record."}
        </p>
      </div>
    );
  }

  if (proofStep === "ask") {
    return (
      <div data-testid="proof-ask" className="space-y-4 rounded-xl border border-sky-200 bg-sky-50 p-6">
        <h2 className="text-lg font-semibold text-sky-900">Lever bewijs van je besparing</h2>
        <p className="text-sm text-sky-900">
          Forward de bevestigingsmail van je provider naar{" "}
          <strong>bewijs@degeldheld.com</strong> (zet{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            [PROOF-{negotiationId}]
          </code>{" "}
          in het onderwerp), <em>of</em> upload een screenshot van je nieuwe
          factuur, <em>of</em> sla over — dan telt je claim niet mee voor /proof
          en wordt er geen fee berekend.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            data-testid="proof-upload-btn"
            onClick={() => setProofStep("upload")}
            disabled={pending}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Upload screenshot of factuur
          </button>
          <button
            type="button"
            data-testid="proof-skip-btn"
            onClick={skipProof}
            disabled={pending}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sla over (claim niet geverifieerd)
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (proofStep === "upload") {
    return (
      <div data-testid="proof-upload" className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-6">
        <h2 className="text-lg font-semibold text-sky-900">Upload je nieuwe factuur</h2>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadProof(f);
          }}
          className="block w-full text-sm"
        />
        {pending && <p className="text-sm text-sky-700">Bewijs wordt geanalyseerd…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => setProofStep("ask")}
          className="text-sm text-slate-600 underline"
        >
          Terug
        </button>
      </div>
    );
  }

  if (proofStep === "rejected") {
    return (
      <div
        data-testid="proof-rejected"
        className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6"
      >
        <h2 className="text-lg font-semibold text-amber-900">Bewijs niet herkend</h2>
        <p className="text-sm text-amber-900">{proofResult}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setProofStep("upload")}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Probeer nog een keer
          </button>
          <button
            type="button"
            onClick={skipProof}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sla over
          </button>
        </div>
      </div>
    );
  }

  if (proofStep === "verified") {
    return (
      <div
        data-testid="proof-verified"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center"
      >
        <h2 className="text-xl font-semibold text-emerald-900">✓ Bewijs geverifieerd!</h2>
        <p className="mt-2 text-sm text-emerald-800">{proofResult}</p>
      </div>
    );
  }

  if (choice === "SUCCESS_SAVED") {
    return (
      <form onSubmit={submitSuccess} className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Wat is je nieuwe maandbedrag?</h2>
        <p className="text-sm text-slate-600">
          Huidig bedrag: €
          {(currentMonthlyCents / 100).toFixed(2).replace(".", ",")}/maand
        </p>
        <input
          type="text"
          inputMode="decimal"
          placeholder="bv 22,50"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          required
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={providerResponded}
            onChange={(e) => setProviderResponded(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Provider antwoordde op de mail
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChoice(null)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          >
            Terug
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setChoice("SUCCESS_SAVED")}
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-left hover:bg-emerald-100"
      >
        <div>
          <div className="text-lg font-semibold text-emerald-900">✓ Geslaagd</div>
          <div className="text-sm text-emerald-700">Provider heeft korting gegeven</div>
        </div>
        <span className="text-emerald-700">→</span>
      </button>
      <button
        type="button"
        onClick={() => submit("STILL_WAITING")}
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-left hover:bg-amber-100 disabled:opacity-50"
      >
        <div>
          <div className="text-lg font-semibold text-amber-900">⏳ Nog wachten</div>
          <div className="text-sm text-amber-700">Geen antwoord ontvangen</div>
        </div>
        <span className="text-amber-700">→</span>
      </button>
      <button
        type="button"
        onClick={() => submit("FAILED_NO_DEAL")}
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-left hover:bg-red-100 disabled:opacity-50"
      >
        <div>
          <div className="text-lg font-semibold text-red-900">✗ Geweigerd</div>
          <div className="text-sm text-red-700">Geen korting gekregen</div>
        </div>
        <span className="text-red-700">→</span>
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
