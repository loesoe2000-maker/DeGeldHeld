/**
 * lib/notify.ts — the ONE gate every retention email must pass through.
 *
 * Hard rules (protects deliverability — never bypass with a raw sendEmail
 * from a cron):
 *   1. Only send when the user has an email AND has not opted out of
 *      marketing (`marketingOptOut`).
 *   2. Always append an unsubscribe footer with a 1-click link.
 *   3. Optional per-type throttle so a cron can't re-mail inside a window.
 *
 * Returns `{ sent, reason? }` so callers can log/skip without throwing.
 */
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

export type RetentionUser = {
  id: string;
  email: string | null;
  name?: string | null;
  marketingOptOut: boolean;
  unsubscribeToken: string | null;
};

/** Lazily mint a stable, unique unsubscribe token for a user. */
export async function ensureUnsubscribeToken(
  userId: string,
  existing: string | null | undefined,
): Promise<string> {
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: userId }, data: { unsubscribeToken: token } });
  return token;
}

export function unsubscribeUrl(token: string): string {
  return `${APP_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

function footerHtml(token: string): string {
  const url = unsubscribeUrl(token);
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
<p style="font-size:12px;color:#94a3b8;line-height:1.5">
Je ontvangt deze e-mail omdat je DeGeldHeld gebruikt om op je vaste lasten te besparen.
Geen bespaar-tips meer? <a href="${url}" style="color:#94a3b8">Schrijf je uit</a>.
</p>`;
}

function footerText(token: string): string {
  return `\n\n—\nGeen bespaar-tips meer? Schrijf je uit: ${unsubscribeUrl(token)}`;
}

export type SendRetentionResult = { sent: boolean; reason?: string };

/**
 * Send a retention email through the gate. `throttle` short-circuits the
 * send if the per-type timestamp is within `minHours` of now — so a cron
 * that re-runs (or fires twice) can't double-mail.
 */
export async function sendRetentionEmail(opts: {
  user: RetentionUser;
  subject: string;
  html: string;
  text: string;
  throttle?: { lastAt: Date | null | undefined; minHours: number };
}): Promise<SendRetentionResult> {
  const { user, throttle } = opts;
  if (!user.email) return { sent: false, reason: "no-email" };
  if (user.marketingOptOut) return { sent: false, reason: "opted-out" };

  if (throttle?.lastAt) {
    const ageMs = Date.now() - throttle.lastAt.getTime();
    if (ageMs < throttle.minHours * 3_600_000) {
      return { sent: false, reason: "throttled" };
    }
  }

  const token = await ensureUnsubscribeToken(user.id, user.unsubscribeToken);
  await sendEmail({
    to: user.email,
    subject: opts.subject,
    html: opts.html + footerHtml(token),
    text: opts.text + footerText(token),
  });
  return { sent: true };
}
