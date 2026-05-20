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

// Extract the (public) project-id from a DSN's trailing path segment.
// Project ids are NOT secret — they appear in client-side bundles.
function dsnProjectId(dsn: string | undefined | null): string | null {
  if (!dsn) return null;
  const m = /\/(\d+)\/?$/.exec(dsn.trim());
  return m ? m[1] : "unparseable";
}

// Diagnostic: what the server env holds + what the initialised Sentry
// SDK actually bound to. Lets us see exactly where a mismatch is.
function dsnDiagnostics() {
  let sdkDsn: string | undefined;
  try {
    sdkDsn = Sentry.getClient()?.getOptions()?.dsn as string | undefined;
  } catch {
    sdkDsn = undefined;
  }
  return {
    envServerProject: dsnProjectId(process.env.SENTRY_DSN),
    envPublicProject: dsnProjectId(process.env.NEXT_PUBLIC_SENTRY_DSN),
    sdkProject: dsnProjectId(sdkDsn),
    sdkInitialised: !!Sentry.getClient(),
  };
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
    return NextResponse.json({ ok: true, configured, environment, ...dsnDiagnostics() });
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
