"use client";

import { useState } from "react";
import { formatEurCents } from "@/lib/format";

/**
 * v37 — herbruikbare "lees bedrag uit document"-knop voor de uitspraak-upload.
 *
 * Stuurt het gekozen bestand naar POST /api/claims/suggest-bedrag (read-only:
 * slaat niks op, charget niks) en roept onApply aan met het voorgestelde
 * bedrag in EURO-string (bv "175,00") zodat het bedrag-veld voorgevuld wordt.
 *
 * Kernprincipe: SUGGESTIE, nooit bindend. De klant ziet het voorstel + context
 * en bevestigt zelf. Bij lage confidence tonen we een extra waarschuwing.
 */
export default function BedragSuggestieKnop({
  file,
  onApply,
}: {
  file: File | null;
  onApply: (euroString: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [low, setLow] = useState(false);

  async function lees() {
    setMsg(null);
    setLow(false);
    if (!file) {
      setMsg("Kies eerst het document hierboven.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/claims/suggest-bedrag", { method: "POST", body: fd });
      const data = (await r.json()) as {
        ok?: boolean;
        found?: boolean;
        cents?: number;
        confidence?: "high" | "low";
        context?: string;
        hint?: string | null;
        error?: string;
      };
      if (!r.ok || !data.ok) {
        setMsg(data.error ?? data.hint ?? "Uitlezen mislukte — vul het bedrag handmatig in.");
        return;
      }
      if (!data.found || typeof data.cents !== "number") {
        setMsg(data.hint ?? "Geen bedrag gevonden — vul het zelf in.");
        return;
      }
      // Vul het veld voor met het Nederlandse formaat (komma als decimaal).
      const euroString = (data.cents / 100).toLocaleString("nl-NL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      onApply(euroString);
      setLow(data.confidence === "low");
      setMsg(
        `Voorgesteld: ${formatEurCents(data.cents)}` +
          (data.context ? ` — uit: "${data.context}"` : "") +
          ". Controleer of dit klopt voordat je verstuurt.",
      );
    } catch {
      setMsg("Uitlezen mislukte — vul het bedrag handmatig in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={lees}
        disabled={busy || !file}
        data-testid="bedrag-suggestie-knop"
        className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40"
      >
        {busy ? "Bezig met uitlezen…" : "📄 Lees bedrag uit document"}
      </button>
      {msg ? (
        <p
          data-testid="bedrag-suggestie-msg"
          className={`mt-1 text-xs ${low ? "text-amber-700" : "text-slate-600"}`}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
