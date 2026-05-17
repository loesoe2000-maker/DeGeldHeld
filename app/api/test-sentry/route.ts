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

export async function GET(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const err = new Error(
    `[test-sentry] intentional error at ${new Date().toISOString()}`,
  );
  const eventId = Sentry.captureException(err, {
    tags: { route: "test-sentry", stage: "intentional" },
  });
  return NextResponse.json({ ok: false, eventId, message: err.message }, { status: 500 });
}
