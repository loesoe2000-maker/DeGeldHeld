/**
 * lib/alert.ts — high-severity alert helper.
 *
 * Pushes to Sentry as `error` + optional webhook (Discord/Telegram).
 * Used by: failing crons, Stripe webhook failures, repeated 5xx in API
 * routes, OCR-cascade total failure.
 */

import * as Sentry from "@sentry/nextjs";

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

export type AlertContext = {
  route?: string;
  userId?: string;
  requestId?: string;
  stage?: string;
  provider?: string;
  strategy?: string;
  extra?: Record<string, string | number | boolean | null>;
};

export async function alertHigh(message: string, ctx: AlertContext = {}): Promise<void> {
  try {
    Sentry.captureMessage(message, {
      level: "error",
      tags: {
        route: ctx.route ?? "unknown",
        stage: ctx.stage ?? "unknown",
        provider: ctx.provider ?? "unknown",
        strategy: ctx.strategy ?? "unknown",
      },
      user: ctx.userId ? { id: ctx.userId } : undefined,
      extra: { requestId: ctx.requestId, ...ctx.extra },
    });
  } catch {
    // sentry init may be missing in dev; swallow
  }

  if (!WEBHOOK_URL) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3_000);
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: `[ALERT] ${message}\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\``,
      }),
      signal: ctrl.signal,
    }).catch(() => {});
    clearTimeout(t);
  } catch {
    // best-effort
  }
}
