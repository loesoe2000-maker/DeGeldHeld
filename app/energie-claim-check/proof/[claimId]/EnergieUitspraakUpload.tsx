"use client";

/**
 * /energie-claim-check/proof/[claimId] — V35 DEEL 2 — upload-client.
 * v37 — klant kan kiezen: nieuw bestand uploaden óf een document uit z'n
 * kluis hergebruiken (documentId). Alle originele velden + tracking behouden.
 *
 * Géén OCR. Géén auto-charge.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { parseEurInput } from "@/lib/format";
import { DOCUMENT_KIND_LABEL, type DocumentKind } from "@/lib/user-documents";

const MAX_BYTES = 10 * 1024 * 1024;

export type VaultDoc = {
  id: string;
  kind: string;
  filename: string;
  createdAt: string;
};

type UploadResponse =
  | { ok: true; status: "UITSPRAAK"; werkelijkeRestitutieCents: number }
  | { ok: false; error: string };

export default function EnergieUitspraakUpload({
  claimId,
  vaultDocs = [],
}: {
  claimId: string;
  vaultDocs?: VaultDoc[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [werkelijk, setWerkelijk] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  // v37 — "nieuw bestand" (default) of "uit mijn kluis".
  const hasVault = vaultDocs.length > 0;
  const [mode, setMode] = useState<"nieuw" | "kluis">("nieuw");
  const [docId, setDocId] = useState<string>(vaultDocs[0]?.id ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cents = parseEurInput(werkelijk);
    if (cents == null || cents < 0) {
      setError("Vul het werkelijk teruggehaalde bedrag in (mag € 0 als niets is uitgekeerd).");
      return;
    }

    const form = new FormData();
    form.append("claimId", claimId);
    form.append("werkelijkeRestitutieCents", String(cents));

    if (mode === "kluis") {
      if (!docId) {
        setError("Kies een document uit je kluis.");
        return;
      }
      form.append("documentId", docId);
    } else {
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
      form.append("file", file);
    }

    setPending(true);
    track("energie_claim_uitspraak_uploaded", { claimSlug: claimId.slice(0, 8) });
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
        PDF van de Geschillencommissie-uitspraak of de schriftelijke bevestiging
        van je energieleverancier. Max 10 MB. Vul daarnaast het werkelijk
        teruggehaalde bedrag in.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4 ph-no-capture">
        {hasVault ? (
          <div className="flex gap-2 text-sm" data-testid="energie-proof-mode">
            <button
              type="button"
              onClick={() => setMode("nieuw")}
              className={`rounded-lg border px-3 py-1.5 font-medium ${
                mode === "nieuw"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              Nieuw bestand
            </button>
            <button
              type="button"
              onClick={() => setMode("kluis")}
              data-testid="energie-proof-kies-kluis"
              className={`rounded-lg border px-3 py-1.5 font-medium ${
                mode === "kluis"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              Uit mijn kluis
            </button>
          </div>
        ) : null}

        {mode === "kluis" && hasVault ? (
          <label className="block text-sm">
            <span className="font-semibold text-slate-900">
              Kies een document uit je kluis
            </span>
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              data-testid="energie-proof-doc-select"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {vaultDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {(DOCUMENT_KIND_LABEL[d.kind as DocumentKind] ?? d.kind)} — {d.filename}
                </option>
              ))}
            </select>
          </label>
        ) : (
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
        )}

        <label className="block text-sm">
          <span className="font-semibold text-slate-900">
            Werkelijk teruggehaald bedrag
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={werkelijk}
            onChange={(e) => setWerkelijk(e.target.value)}
            placeholder="bv. 120,00"
            data-testid="energie-proof-werkelijk"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-1/2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Mag € 0 als de Geschillencommissie niets toekende. Onder € 50
            werkelijk → fee € 0.
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
                We hebben je upload verwerkt. Iemand van ons reviewt 'm en schrijft
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
