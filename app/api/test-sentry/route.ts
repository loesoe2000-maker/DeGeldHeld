/**
 * /api/test-sentry — deliberate error trigger for dashboard verification.
 *
 * Only active when SENTRY_ENVIRONMENT != "production" OR
 * Authorization header carries `Bearer ${CRON_SECRET}` (allows you to
 * test Sentry routing in prod without exposing the endpoint).
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowed(req: Request): boolean {
  if ((process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV) !== "production") return true;
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

// True when a DSN is wired into the runtime — reported as a plain boolean
// so you can confirm the env is set without ever echoing the DSN itself.
function dsnConfigured(): boolean {
  return !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export async function GET(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configured = dsnConfigured();
  const environment =
    process.env.VERCEL_ENV ??
    process.env.SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    "unknown";

  // Default: just report config status — don't spam Sentry on every health
  // poll. Pass ?fire=1 to actually throw a tagged test error.
  const url = new URL(req.url);
  if (url.searchParams.get("fire") !== "1") {
    return NextResponse.json({ ok: true, configured, environment });
  }

  const err = new Error(
    `[test-sentry] intentional error at ${new Date().toISOString()}`,
  );
  const eventId = Sentry.captureException(err, {
    tags: { route: "test-sentry", test: true },
  });
  await Sentry.flush(2000);
  return NextResponse.json(
    { ok: false, configured, environment, eventId, message: err.message },
    { status: 500 },
  );
}
