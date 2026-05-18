/**
 * lib/email-thread.ts — RFC 5322 email thread tracking.
 *
 * Each Negotiation owns a UUID thread-id; that id is embedded in the
 * Message-ID header of every outbound mail (`<thread-id@degeldheld.com>`).
 * When a provider replies, the In-Reply-To / References header contains
 * the same thread-id which lets the inbound webhook find the right
 * negotiation.
 *
 * Used by:
 *   - lib/inbound-router.ts        (parse In-Reply-To → match)
 *   - app/api/inbound/router/route (webhook entry)
 *   - lib/email.ts                 (outbound Message-ID injection)
 */

import crypto from "node:crypto";

const DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "degeldheld.com";

/** Generate a fresh thread-id for a new negotiation. */
export function generateThreadId(): string {
  return crypto.randomUUID();
}

/** Outbound Message-ID for a given thread (RFC 5322 angle-bracket form). */
export function messageIdFor(threadId: string): string {
  return `<${threadId}@${DOMAIN}>`;
}

/**
 * Extract a thread-id from an In-Reply-To or References header. Returns
 * null when the header is missing, malformed, or addresses a different
 * domain.
 *
 * RFC 5322: Message-ID = "<" id-left "@" id-right ">"
 * In-Reply-To: <id1@example.com>
 * References:  <id1@example.com> <id2@example.com>
 */
export function extractThreadId(header: string | null | undefined): string | null {
  if (!header) return null;
  // Match any <uuid@domain> token. Prefer the *last* one in the chain so
  // that References-headers (which chronicle the entire thread) return
  // the most recent ancestor.
  const matches = [...header.matchAll(/<([^@>]+)@([^>]+)>/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const [, idLeft, idRight] = matches[i];
    const trimmedDomain = idRight.trim();
    if (trimmedDomain !== DOMAIN) continue;
    // Basic UUID-shape sanity-check (8-4-4-4-12 hex)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idLeft.trim())) {
      continue;
    }
    return idLeft.trim().toLowerCase();
  }
  return null;
}

/**
 * v12 subject-token helpers — the inbound router multiplexes proof
 * uploads and negotiation replies on the SAME webhook (DEEL 1).
 * Discrimination falls back to In-Reply-To when neither token is set.
 *
 *  - [PROOF-<billId>]        → proof-flow
 *  - [NEGOTIATION-<negId>]   → auto-pingpong
 */

/** Extract a [PROOF-<id>] token from a subject. Returns the bare id. */
export function extractProofSubjectToken(subject: string): string | null {
  const m = /\[PROOF-([a-zA-Z0-9_-]{20,40})\]/.exec(subject);
  return m ? m[1] : null;
}

/** Extract a [NEGOTIATION-<id>] token from a subject. Returns the bare id. */
export function extractNegotiationSubjectToken(subject: string): string | null {
  const m = /\[NEGOTIATION-([a-zA-Z0-9_-]{20,40})\]/.exec(subject);
  return m ? m[1] : null;
}

/** Pretty header bundle for outbound mails — caller spreads into `headers` opt. */
export function outboundThreadHeaders(threadId: string, inReplyToThreadId?: string | null) {
  const hdrs: Record<string, string> = {
    "Message-ID": messageIdFor(threadId),
  };
  if (inReplyToThreadId) {
    hdrs["In-Reply-To"] = messageIdFor(inReplyToThreadId);
    hdrs["References"] = messageIdFor(inReplyToThreadId);
  }
  return hdrs;
}
