import type { Negotiation, NegotiationState } from "@prisma/client";

export type SavingsStats = {
  totalSavedCents: number;
  totalSuccessful: number;
  totalAttempts: number;
  successRate: number; // 0..1
  pendingCount: number;
  averageSavingsCents: number;
};

export function computeSavingsStats(
  negotiations: Pick<Negotiation, "state" | "actualSavingsCents">[],
): SavingsStats {
  let totalSavedCents = 0;
  let totalSuccessful = 0;
  let pending = 0;
  let attempts = 0;
  for (const n of negotiations) {
    attempts += 1;
    if (n.state === "SUCCESS" || n.state === "BILLED") {
      totalSuccessful += 1;
      totalSavedCents += n.actualSavingsCents ?? 0;
    } else if (
      n.state === "NIEUW" ||
      n.state === "BILL_UPLOAD" ||
      n.state === "ANALYSE" ||
      n.state === "EMAIL_GEN" ||
      n.state === "AWAITING"
    ) {
      pending += 1;
    }
  }
  const successRate = attempts > 0 ? totalSuccessful / attempts : 0;
  const averageSavingsCents = totalSuccessful > 0 ? Math.round(totalSavedCents / totalSuccessful) : 0;
  return {
    totalSavedCents,
    totalSuccessful,
    totalAttempts: attempts,
    successRate,
    pendingCount: pending,
    averageSavingsCents,
  };
}

export function negotiationLabel(state: NegotiationState): string {
  const labels: Record<NegotiationState, string> = {
    NIEUW: "Nieuw",
    BILL_UPLOAD: "Rekening geüpload",
    ANALYSE: "Analyse loopt",
    EMAIL_GEN: "Email opgesteld",
    AWAITING: "Wacht op provider",
    EMAIL_SENT: "Email verstuurd",
    RESPONSE_RECEIVED: "Antwoord ontvangen",
    COUNTER_SENT: "Counter-mail verstuurd",
    ACCEPTED: "Akkoord — deal gesloten",
    REJECTED: "Geweigerd",
    SUCCESS: "Geslaagd",
    FAILED: "Niet gelukt",
    BILLED: "Afgerond",
    SUCCESS_UNVERIFIED: "Geslaagd (niet geverifieerd)",
    BILLED_PENDING_PAYMENT: "Fee — wacht op betaling",
    BILLED_OVERDUE: "Fee — betaling te laat",
  };
  return labels[state] ?? state;
}

export function isOpenState(state: NegotiationState): boolean {
  return [
    "NIEUW",
    "BILL_UPLOAD",
    "ANALYSE",
    "EMAIL_GEN",
    "AWAITING",
    "EMAIL_SENT",
    "RESPONSE_RECEIVED",
    "COUNTER_SENT",
  ].includes(state);
}

export function isClosedState(state: NegotiationState): boolean {
  return ["SUCCESS", "FAILED", "BILLED", "ACCEPTED", "REJECTED"].includes(state);
}

export function tierClass(state: NegotiationState): string {
  if (state === "SUCCESS" || state === "BILLED" || state === "ACCEPTED") {
    return "bg-brand-100 text-brand-800";
  }
  if (state === "FAILED" || state === "REJECTED") return "bg-red-100 text-red-800";
  if (state === "AWAITING" || state === "EMAIL_SENT" || state === "COUNTER_SENT") {
    return "bg-amber-100 text-amber-800";
  }
  if (state === "RESPONSE_RECEIVED") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}
