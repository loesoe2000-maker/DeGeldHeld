/**
 * lib/relay.ts — v23 negotiate-on-behalf RELAY core.
 *
 * This module owns the two HARD GUARDRAILS — no relay path may bypass them:
 *
 *   1. CONSENT-FIRST   — `canRelaySend()` is the single gate every send must
 *      pass. It returns false unless the customer explicitly authorized the
 *      relay (relayAuthorizedAt) AND the relay is actively running
 *      (relayState === RELAY_ACTIVE). No authorization → no send, ever.
 *
 *   2. HUMAN-IN-THE-LOOP ON COMMITMENT — `relayDecision()` decides what
 *      happens with a provider reply. Routine "can you do better?" counters
 *      may auto-send; anything that accepts a deal / commits / finalises a
 *      saving must go to AWAITING_APPROVAL (the customer decides). The
 *      decision NEVER returns "accept" as an automatic action.
 */
import crypto from "node:crypto";
import type { RoundAnalysis } from "@/lib/rounds";
import { MAX_ROUNDS } from "@/lib/rounds";

const DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "degeldheld.com";

export type RelayState = "RELAY_ACTIVE" | "AWAITING_APPROVAL" | "PAUSED" | "DONE";

/** Max auto-counters before the relay always hands back to the customer. */
export const MAX_AUTO_ROUNDS = 5;

/**
 * Crypto-random, unguessable relay token (anti-abuse: routes only to its own
 * negotiation). Hex (lowercase, no mixed case): email systems routinely
 * lowercase the address local-part, so a mixed-case token (e.g. base64url)
 * could fail to match on the provider's inbound reply. Hex sidesteps that.
 */
export function generateRelayToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * The exact machtiging (volmacht) text the customer accepts — stored per
 * negotiation as relayAuthText (audit). Strictly scoped to negotiating, NOT
 * accepting a contract (see docs/MACHTIGING.md). Concept — juridisch te toetsen.
 */
export function relayMandateText(provider: string): string {
  return (
    `Ik machtig DeGeldHeld om namens mij te onderhandelen en corresponderen met ` +
    `${provider} over mijn bestaande contract. Deze machtiging is beperkt tot ` +
    `onderhandelen en corresponderen: DeGeldHeld mag géén nieuw of gewijzigd ` +
    `contract namens mij accepteren of afsluiten — elk concreet aanbod keur ik ` +
    `zelf goed. Ik kan deze machtiging altijd intrekken (pauzeren/stoppen).`
  );
}

/** Reply-to address that routes provider replies back to this relay. */
export function relayReplyTo(token: string): string {
  return `onderhandel+${token}@${DOMAIN}`;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Unmonitored mailboxes — a relay mail there is silently lost.
const NOREPLY_RE = /^(no-?reply|do-?not-?reply|noreply|donotreply|geen-?antwoord)\b/i;

export type RelayAddressSanity =
  | { ok: true }
  | { ok: false; reason: "invalid-format" | "noreply" };

/**
 * v26 — sanity gate before the FIRST relay send. HARD-rejects only the
 * unambiguous cases: a malformed address, or a no-reply / do-not-reply mailbox
 * (a relay mail there never reaches a human). Domain-mismatch is intentionally
 * NOT hard-blocked here — see relayDomainLooksOff (advisory, false-positive
 * prone, so the UI uses it to nudge "klopt dit?" rather than to refuse).
 */
export function relayAddressSanity(email: string): RelayAddressSanity {
  const e = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, reason: "invalid-format" };
  const local = e.slice(0, e.indexOf("@"));
  if (NOREPLY_RE.test(local)) return { ok: false, reason: "noreply" };
  return { ok: true };
}

/**
 * v26 advisory: does the address-domain look unrelated to the provider? Crude
 * token-overlap heuristic — used ONLY as a soft "klopt dit?" hint (never to
 * hard-block), because brand↔domain mismatches are common (e.g. resellers).
 */
export function relayDomainLooksOff(email: string, providerCanonical: string): boolean {
  const at = (email ?? "").indexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  const core = (providerCanonical ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (core.length < 3) return false;
  const domainCore = domain.replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9]/g, "");
  if (!domainCore) return false;
  return !domainCore.includes(core) && !core.includes(domainCore);
}

/**
 * Extract a relay token from one or more recipient addresses
 * (onderhandel+<token>@domain). Returns null when none match.
 */
export function extractRelayToken(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    const m = /onderhandel\+([A-Za-z0-9_-]{16,64})@/i.exec(addr);
    if (m) return m[1];
  }
  return null;
}

/**
 * GUARDRAIL 1 — consent-first send gate. EVERY mail sent on the customer's
 * behalf must pass this. No authorization or not actively relaying → false.
 */
export function canRelaySend(neg: {
  relayAuthorizedAt: Date | null;
  relayState: string | null;
}): boolean {
  return !!neg.relayAuthorizedAt && neg.relayState === "RELAY_ACTIVE";
}

export type RelayDecision =
  | { kind: "auto_counter" } // routine — relay may send the counter automatically
  | { kind: "needs_approval"; reason: "deal" | "commitment" | "provider_pushback" | "loop_guard" }
  | { kind: "stop"; reason: "walk_away" } // provider closed the door — hand back
  | { kind: "noop"; reason: "no_counter_needed" };

/**
 * Detect a provider asking the account-holder to confirm in person
 * ("bent u de contracthouder?", "we hebben uw akkoord/handtekening nodig").
 * Such steps must NEVER be faked by the relay → always to the customer.
 */
const ACCOUNT_HOLDER_RE =
  /(contracthouder|rekeninghouder|account[- ]?holder|persoonlijk bevestigen|zelf bevestigen|uw (?:schriftelijke )?(?:akkoord|toestemming|handtekening)|identiteit verifi|legitim|machtiging overleggen|are you the (?:account|contract) holder|need your (?:written )?(?:consent|confirmation|signature))/i;

export function providerAsksAccountHolder(text: string): boolean {
  return ACCOUNT_HOLDER_RE.test(text ?? "");
}

/**
 * GUARDRAIL 2 — decide what to do with a provider reply. Pure function.
 *
 * Priority (most restrictive first):
 *   - provider asks the account-holder to confirm → needs_approval
 *   - provider walked away → stop (hand back, no auto-send)
 *   - AI says "accept" (a concrete acceptable deal) → needs_approval (deal)
 *   - loop-guard exhausted → needs_approval
 *   - AI says "counter" → auto_counter (the routine automatic path)
 *   - escalate / nothing → noop (hand back to customer; we don't auto-escalate)
 *
 * NB: "accept" is NEVER returned as an automatic action.
 */
export function relayDecision(opts: {
  analysis: Pick<RoundAnalysis, "action">;
  providerText: string;
  autoRoundsUsed: number;
}): RelayDecision {
  if (providerAsksAccountHolder(opts.providerText)) {
    return { kind: "needs_approval", reason: "provider_pushback" };
  }
  if (opts.analysis.action === "walk_away") {
    return { kind: "stop", reason: "walk_away" };
  }
  if (opts.analysis.action === "accept") {
    // A concrete, acceptable deal — the customer must approve it.
    return { kind: "needs_approval", reason: "deal" };
  }
  if (opts.autoRoundsUsed >= MAX_AUTO_ROUNDS || opts.autoRoundsUsed >= MAX_ROUNDS) {
    // Endless AI ping-pong guard — hand back to the human.
    return { kind: "needs_approval", reason: "loop_guard" };
  }
  if (opts.analysis.action === "counter") {
    return { kind: "auto_counter" };
  }
  // escalate / unknown → don't auto-act; surface to the customer.
  return { kind: "noop", reason: "no_counter_needed" };
}

/** Human-readable status for the UI badge. */
export function relayStatusLabel(state: string | null): string {
  switch (state) {
    case "RELAY_ACTIVE":
      return "Automatisch onderhandelen actief";
    case "AWAITING_APPROVAL":
      return "Wacht op jouw goedkeuring";
    case "PAUSED":
      return "Gepauzeerd";
    case "DONE":
      return "Klaar";
    default:
      return "Handmatig";
  }
}
