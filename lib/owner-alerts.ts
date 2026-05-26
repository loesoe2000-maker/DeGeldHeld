/**
 * lib/owner-alerts.ts — V36 DEEL 3.
 *
 * Centraal kanaal voor "iets ging niet zoals het hoort"-notificaties naar
 * de owner. Vóór V36 vingen we deze events in Sentry op (goed voor stack-
 * traces) maar zonder e-mail-trigger, dus owner zag ze pas bij de
 * volgende dashboard-check. Eén mail per event = sneller reageren op
 * dingen die geld of vertrouwen kosten.
 *
 * Ontwerp-discipline:
 *  - Géén PII in mail-body: alleen technische identifiers + samenvatting.
 *    Bedragen mogen wel (financiële context), provider/email-strings niet.
 *  - Best-effort: faalt nooit de hoofd-flow. Sentry vangt mail-fouten.
 *  - Throttle-light: in-process dedup-window (60 min per event-type+ref)
 *    om mail-stormen bij retry-loops te voorkomen.
 *  - Skip in test/dev als OWNER_EMAIL ontbreekt — geen ruis in CI.
 *
 * Geconsumeerd door:
 *  - cron-fail-path (lib/cron-auth.logCronEvent("failed") sites)
 *  - FAILED-claim-path (Box3 proof-back + Huur/Energie uitspraak)
 *  - Stripe-webhook-error-path (route catch-blok)
 *  - OCR-failure-path (extractPdfText empty → FAILED)
 */

import { sendEmail } from "@/lib/email";
import * as Sentry from "@sentry/nextjs";

/** De vier kanalen die mail-triggert (V36-scope). */
export type OwnerAlertEvent =
  | "cron-failed"
  | "claim-failed"
  | "stripe-webhook-error"
  | "ocr-failed";

export type OwnerAlertPayload = {
  /** Korte 1-regel beschrijving — komt in mail-subject. */
  summary: string;
  /** Optionele identifier voor dedup (bv. claimId, eventId, cronJob). */
  ref?: string;
  /** Vrije details — toon als pre-formatted JSON in mail-body. */
  details?: Record<string, unknown>;
};

/** In-process dedup-cache. 60 min TTL. Werkt alleen binnen één serverless-instance. */
const DEDUP_TTL_MS = 60 * 60 * 1000;
const dedupCache = new Map<string, number>();

function dedupKey(event: OwnerAlertEvent, ref?: string): string {
  return ref ? `${event}:${ref}` : event;
}

function isDedupHit(key: string, now: number): boolean {
  const seen = dedupCache.get(key);
  if (seen != null && now - seen < DEDUP_TTL_MS) return true;
  dedupCache.set(key, now);
  return false;
}

/** Reset cache — alléén voor tests. */
export function resetOwnerAlertDedup(): void {
  dedupCache.clear();
}

/**
 * Verstuur een alert naar OWNER_EMAIL. Best-effort: geen throw, géén block.
 *
 * Returns:
 *  - "sent": mail verstuurd (of in test-mode: skipped door Resend-stub)
 *  - "deduped": skipped omdat dezelfde (event, ref) binnen 60 min al ging
 *  - "no-owner-email": OWNER_EMAIL niet geconfigureerd → skip in dev/test
 *  - "send-failed": Resend gooide een fout (Sentry vangt 'm óók)
 */
export async function notifyOwner(
  event: OwnerAlertEvent,
  payload: OwnerAlertPayload,
): Promise<"sent" | "deduped" | "no-owner-email" | "send-failed"> {
  const ownerEmail = process.env.OWNER_EMAIL ?? "";
  if (!ownerEmail) return "no-owner-email";

  const key = dedupKey(event, payload.ref);
  if (isDedupHit(key, Date.now())) return "deduped";

  const subject = `[DeGeldHeld owner-alert] ${event}: ${payload.summary}`;
  const detailLines = payload.details
    ? Object.entries(payload.details).map(([k, v]) => `  ${k}: ${formatValue(v)}`)
    : [];
  const refLine = payload.ref ? `Ref: ${payload.ref}\n` : "";
  const text =
    `Event:   ${event}\n` +
    `Tijd:    ${new Date().toISOString()}\n` +
    `${refLine}` +
    `Samenvatting:\n  ${payload.summary}\n\n` +
    (detailLines.length > 0 ? `Details:\n${detailLines.join("\n")}\n\n` : "") +
    `— DeGeldHeld owner-alerts`;
  const html =
    `<p><strong>Event:</strong> <code>${event}</code></p>` +
    `<p><strong>Tijd:</strong> ${new Date().toISOString()}</p>` +
    (payload.ref ? `<p><strong>Ref:</strong> <code>${escapeHtml(payload.ref)}</code></p>` : "") +
    `<p><strong>Samenvatting:</strong><br>${escapeHtml(payload.summary)}</p>` +
    (detailLines.length > 0
      ? `<p><strong>Details:</strong></p><pre style="background:#f8fafc;padding:8px;border-radius:4px;font-family:ui-monospace">${escapeHtml(detailLines.join("\n"))}</pre>`
      : "") +
    `<p style="color:#64748b;font-size:12px">— DeGeldHeld owner-alerts</p>`;

  try {
    await sendEmail({ to: ownerEmail, subject, text, html });
    return "sent";
  } catch (e) {
    try {
      Sentry.captureException(e, { tags: { module: "owner-alerts", event } });
    } catch {
      /* sentry optional */
    }
    return "send-failed";
  }
}

function formatValue(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    // JSON.stringify returns undefined for functions / symbols / undefined-leaves.
    return s ?? "(unserializable)";
  } catch {
    return "(unserializable)";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
