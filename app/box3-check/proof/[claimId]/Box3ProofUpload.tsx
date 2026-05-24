"use client";

/**
 * /box3-check/proof/[claimId] — upload-client voor de Box 3-beschikking.
 * Privacy: alleen het PDF-bestand verlaat de browser (richting onze server),
 * en we slaan 't op met de AVG-grondslag "uitvoering overeenkomst" — zie
 * paginavoettekst.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { formatEurCents } from "@/lib/format";

const MAX_BYTES = 10 * 1024 * 1024;

type UploadResponse =
  | {
      ok: true;
      status: "CHARGED";
      werkelijkTeruggaveCents: number;
      feeCents: number;
      paymentIntentId?: string;
      reden?: string;
    }
  | { ok: false; status: "FAILED"; reason: string; werkelijkTeruggaveCents?: number };

export default function Box3ProofUpload({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Kies eerst een PDF van je Belastingdienst-beschikking.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Het bestand is groter dan 10 MB.");
      return;
    }
    if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      setError("Alleen PDF — andere bestandstypen niet ondersteund.");
      return;
    }

    setPending(true);
    track("box3_proof_uploaded", { claimSlug: claimId.slice(0, 8) });
    const form = new FormData();
    form.append("claimId", claimId);
    form.append("file", file);
    try {
      const r = await fetch("/api/box3/proof-back", { method: "POST", body: form });
      const data = (await r.json()) as UploadResponse;
      setResult(data);
      if (data.ok && data.status === "CHARGED") {
        track("box3_fee_charged", {
          feeCents: data.feeCents,
          basisCents: data.werkelijkTeruggaveCents,
        });
      } else if (!data.ok) {
        track("box3_proof_failed", { reason: data.reason });
      }
      // Force-revalidate de page state-block.
      setTimeout(() => router.refresh(), 800);
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Upload je beschikking</h2>
      <p className="mt-1 text-sm text-slate-700">
        PDF van de Belastingdienst (te vinden in MijnBelastingdienst →{" "}
        <em>Documenten</em>). Max 10 MB.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4 ph-no-capture">
        <label className="block text-sm">
          <span className="font-semibold text-slate-900">Bestand</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            data-testid="box3-proof-file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          data-testid="box3-proof-submit"
          className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40"
        >
          {pending ? "Bezig met verwerken…" : "Upload + verwerk"}
        </button>
      </form>

      {result ? (
        <div
          data-testid="box3-proof-result"
          className={`mt-6 rounded-xl border p-4 text-sm ${
            result.ok ? "border-brand-200 bg-brand-50 text-brand-900" : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {result.ok && result.status === "CHARGED" ? (
            <>
              <p className="font-semibold">
                Klaar ✓ — fee:{" "}
                {result.feeCents > 0
                  ? `${formatEurCents(result.feeCents)} (25%)`
                  : "€ 0 (werkelijk < € 500)"}
              </p>
              <p className="mt-1">
                Werkelijk teruggehaald:{" "}
                <strong>{formatEurCents(result.werkelijkTeruggaveCents)}</strong>.
                {result.reden ? <> {result.reden}</> : null}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">We konden de beschikking niet automatisch uitlezen.</p>
              <p className="mt-1">{(result as { reason: string }).reason}. Iemand neemt contact op.</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
