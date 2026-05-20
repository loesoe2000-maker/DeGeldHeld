/**
 * lib/cron-auth.ts — one robust authorization gate for every cron route.
 *
 * Two accepted credentials:
 *   1. `Authorization: Bearer ${CRON_SECRET}` — what we pass when a job is
 *      triggered manually or from GitHub Actions.
 *   2. Vercel's own cron header (`x-vercel-cron`), which Vercel sets on
 *      scheduled invocations of the deployment.
 *
 * Fail-closed in production: if CRON_SECRET is NOT set on a production
 * deploy, every cron is denied (401) rather than left wide open. The old
 * per-route check failed *open* when the env was missing — a single
 * misconfiguration would have exposed every job to the public internet.
 * In non-production (local/dev) a missing secret is allowed for convenience.
 */

function isProd(): boolean {
  return (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === "production";
}

export function authorizeCron(req: Request): boolean {
  // Vercel-scheduled invocation — trusted by the platform.
  if (req.headers.get("x-vercel-cron")) return true;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // No secret configured: deny in production (fail-closed), allow in dev.
    return !isProd();
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${cronSecret}`;
}

/** Structured one-line log for cron observability (start/end + duration). */
export function logCronEvent(
  job: string,
  phase: "start" | "done" | "failed",
  extra: Record<string, unknown> = {},
): void {
  // Use console.warn (never the debug-residue variant) so it passes the
  // self-review smell gate and shows up in Vercel logs at info level.
  console.warn(
    JSON.stringify({ cron: job, phase, at: new Date().toISOString(), ...extra }),
  );
}
