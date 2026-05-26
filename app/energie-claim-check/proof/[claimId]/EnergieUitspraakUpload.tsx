"use client";

/**
 * /energie-claim-check/proof/[claimId] — V35 DEEL 2 — upload-client.
 *
 * Klant uploadt Geschillencommissie-uitspraak (PDF) + geeft handmatig het
 * werkelijk teruggehaalde bedrag op. Géén OCR. Géén auto-charge: owner
 * reviewt + triggert fee handmatig.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { parseEurInput } from "@/lib/format";

const MAX_BYTES = 10 * 1024 * 1024;

type UploadResponse =
  | { ok: true; status: "UITSPRAAK"; werkelijkeRestitutieCents: number }
  | { ok: false; error: string };

export default function EnergieUitspraakUpload({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [werkelijk, setWerkelijk] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Kies eerst een PDF van de Geschillencommissie-uitspraak of leverancier-bevestiging.");
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
    const cents = parseEurInput(werkelijk);
    if (cents == null || cents < 0) {
      setError("Vul het werkelijk teruggehaalde bedrag in (mag € 0 als niets is uitgekeerd).");
      return;
    }

    setPending(true);
    track("energie_claim_uitspraak_uploaded", { claimSlug: claimId.slice(0, 8) });
    const form = new FormData();
    form.append("claimId", claimId);
    form.append("werkelijkeRestitutieCents", String(cents));
    form.append("file", file);
    try {
      const r = await fetch("/api/energie-claim/uitspraak", { method: "POST", body: form });
      const data = (await r.json()) as UploadResponse;
      setResult(data);
      setTimeout(() => router.refresh(), 800);
    } catch {
      setError("Netwerkfout — probeer het opnieuw.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Upload de uitspraak</h2>
      <p className="mt-1 text-sm text-slate-700">
        PDF van de Geschillencommissie Energie-uitspraak of de schriftelijke
        bevestiging van je leverancier. Max 10 MB. Vul daarnaast het werkelijk
        teruggehaalde bedrag in zoals het op de uitspraak staat.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4 ph-no-capture">
        <label className="block text-sm">
          <span className="font-semibold text-slate-900">Bestand</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            data-testid="energie-proof-file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-slate-900">
            Werkelijk teruggehaald bedrag
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={werkelijk}
            onChange={(e) => setWerkelijk(e.target.value)}
            placeholder="bv. 87,50"
            data-testid="energie-proof-werkelijk"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-1/2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Mag € 0 als Geschillencommissie/leverancier geen restitutie toekende.
            Onder € 50 werkelijk → fee € 0 (eerlijke uitkomst).
          </span>
        </label>
        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          data-testid="energie-proof-submit"
          className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40"
        >
          {pending ? "Bezig met uploaden…" : "Upload + indienen"}
        </button>
      </form>

      {result ? (
        <div
          data-testid="energie-proof-result"
          className={`mt-6 rounded-xl border p-4 text-sm ${
            result.ok
              ? "border-brand-200 bg-brand-50 text-brand-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {result.ok ? (
            <>
              <p className="font-semibold">Uitspraak ontvangen ✓</p>
              <p className="mt-1">
                We hebben je upload verwerkt. Iemand van ons reviewt 'm + schrijft
                de fee handmatig af binnen 1-2 werkdagen (alléén áls werkelijk
                teruggehaald ≥ € 50).
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Er ging iets mis.</p>
              <p className="mt-1">{(result as { error: string }).error}</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
