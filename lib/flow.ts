/**
 * Negotiation state machine.
 *
 *   NIEUW → BILL_UPLOAD → ANALYSE → EMAIL_GEN → AWAITING
 *                                                 ├→ SUCCESS → BILLED
 *                                                 └→ FAILED
 *
 * Strict transitions: invalid → throws. State is persisted on Negotiation row.
 */

import type { NegotiationState } from "@prisma/client";

const TRANSITIONS: Record<NegotiationState, NegotiationState[]> = {
  NIEUW: ["BILL_UPLOAD", "FAILED"],
  BILL_UPLOAD: ["ANALYSE", "FAILED"],
  ANALYSE: ["EMAIL_GEN", "FAILED"],
  EMAIL_GEN: ["AWAITING", "FAILED"],
  AWAITING: ["SUCCESS", "FAILED"],
  SUCCESS: ["BILLED"],
  FAILED: [],
  BILLED: [],
};

export function canTransition(from: NegotiationState, to: NegotiationState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextState(current: NegotiationState): NegotiationState | null {
  const allowed = TRANSITIONS[current] ?? [];
  return allowed[0] ?? null;
}

export function terminalStates(): NegotiationState[] {
  return ["BILLED", "FAILED"];
}

export function isTerminal(s: NegotiationState): boolean {
  return terminalStates().includes(s);
}

export function transition(from: NegotiationState, to: NegotiationState): NegotiationState {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition ${from} → ${to}`);
  }
  return to;
}

export const FOLLOW_UP_DAYS = 7;
export const FOLLOW_UP_MAX_TRIES = 2;

export function computeFollowUpAt(emailGenAt: Date): Date {
  return new Date(emailGenAt.getTime() + FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);
}

export function shouldFollowUp(opts: {
  state: NegotiationState;
  followUpAt: Date | null;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  if (opts.state !== "AWAITING") return false;
  if (!opts.followUpAt) return false;
  return opts.followUpAt <= now;
}

export type OutcomeChoice = "SUCCESS_SAVED" | "FAILED_NO_DEAL" | "STILL_WAITING";

export function outcomeToState(choice: OutcomeChoice): {
  state: NegotiationState;
  closedAt: Date | null;
} {
  switch (choice) {
    case "SUCCESS_SAVED":
      return { state: "SUCCESS", closedAt: new Date() };
    case "FAILED_NO_DEAL":
      return { state: "FAILED", closedAt: new Date() };
    case "STILL_WAITING":
      return { state: "AWAITING", closedAt: null };
  }
}
