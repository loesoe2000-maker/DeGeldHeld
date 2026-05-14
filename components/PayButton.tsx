"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { formatEurCents } from "@/lib/format";

export default function PayButton({
  negotiationId,
  amountCents,
}: {
  negotiationId: string;
  amountCents: number;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId }),
      });
      const data: { ok?: boolean; checkoutUrl?: string; error?: string } = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        toast(data.error ?? "Kon checkout niet starten", "error");
        setBusy(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      toast("Netwerkfout — probeer opnieuw", "error");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {busy
        ? "Verbinden met Stripe…"
        : `Betaal ${formatEurCents(amountCents)} via iDEAL of card`}
    </button>
  );
}
