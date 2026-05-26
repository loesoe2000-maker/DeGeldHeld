"use client";

/**
 * /admin/claims AdminChargeButton — V36 DEEL 1.
 *
 * Owner-only knop die /api/admin/claims/charge POST't. Toont resultaat
 * inline (success / fail) zodat owner direct ziet of de fee is geboekt.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEurCents } from "@/lib/format";
import type { ClaimType } from "@/lib/admin-claims";

type Response =
  | { ok: true; paymentIntentId: string; feeCents: number }
  | { ok: false; reason: string };

export default function AdminChargeButton({
  type,
  claimId,
  feeCents,
}: {
  type: ClaimType;
  claimId: string;
  feeCents: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "pending" }
    | { kind: "ok"; message: string }
    | { kind: "fail"; message: string }
  >({ kind: "idle" });

  async function onClick() {
    if (state.kind === "pending") return;
    if (!confirm(`Charge fee ${formatEurCents(feeCents)} op ${type}#${claimId.slice(0, 8)}?`)) {
      return;
    }
    setState({ kind: "pending" });
    try {
      const r = await fetch("/api/admin/claims/charge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, claimId }),
      });
      const data = (await r.json().catch(() => ({}))) as Response;
      if (r.ok && (data as { ok?: boolean }).ok) {
        const success = data as { ok: true; paymentIntentId: string; feeCents: number };
        setState({
          kind: "ok",
          message: `✓ Geboekt: ${formatEurCents(success.feeCents)} (${success.paymentIntentId.slice(0, 12)}…)`,
        });
        setTimeout(() => router.refresh(), 1000);
      } else {
        const reason =
          (data as { reason?: string }).reason ?? `HTTP ${r.status}`;
        setState({ kind: "fail", message: `✗ ${reason}` });
      }
    } catch (e) {
      setState({ kind: "fail", message: `✗ ${(e as Error).message}` });
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid={`admin-charge-${claimId}`}
        onClick={onClick}
        disabled={state.kind === "pending" || state.kind === "ok"}
        className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40"
      >
        {state.kind === "pending"
          ? "Bezig…"
          : state.kind === "ok"
            ? "Geboekt ✓"
            : `Charge fee ${formatEurCents(feeCents)} →`}
      </button>
      {state.kind === "ok" ? (
        <p data-testid={`admin-charge-ok-${claimId}`} className="mt-1 text-xs text-brand-800">
          {state.message}
        </p>
      ) : null}
      {state.kind === "fail" ? (
        <p
          data-testid={`admin-charge-fail-${claimId}`}
          className="mt-1 text-xs text-rose-700"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
