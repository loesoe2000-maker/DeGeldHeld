/**
 * lib/rate-limit.ts
 *
 * Sliding-window rate limiter for API routes.
 *
 * Storage: in-memory Map (per Node process). For multi-instance serverless
 * (Vercel) this resets per cold-start, which is fine for abuse-defence at
 * our current scale — a global Redis bucket can be slotted in later.
 *
 * Usage:
 *   const r = await rateLimit({ key: `bills:${userId}`, max: 5, windowSec: 3600 });
 *   if (!r.ok) return rateLimitResponse(r);
 */
import { NextResponse } from "next/server";

type Bucket = number[]; // timestamps (ms) of recent requests
const BUCKETS: Map<string, Bucket> = new Map();

export type RateLimitOptions = {
  key: string;            // identifier (e.g. `bills:${userId}`)
  max: number;            // max requests in window
  windowSec: number;      // window length in seconds
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetSec: number;       // seconds until the oldest request leaves the window
  limit: number;
};

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const cutoff = now - windowMs;

  const existing = BUCKETS.get(opts.key) ?? [];
  // drop expired entries
  const fresh = existing.filter((ts) => ts > cutoff);

  if (fresh.length >= opts.max) {
    const oldest = fresh[0];
    const resetSec = Math.ceil((oldest + windowMs - now) / 1000);
    BUCKETS.set(opts.key, fresh);
    return { ok: false, remaining: 0, resetSec: Math.max(1, resetSec), limit: opts.max };
  }

  fresh.push(now);
  BUCKETS.set(opts.key, fresh);
  return { ok: true, remaining: opts.max - fresh.length, resetSec: 0, limit: opts.max };
}

export function rateLimitResponse(r: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "rate_limited",
      message: "Even rustig — je hebt veel verzoeken in korte tijd. Probeer het later opnieuw.",
      retryAfterSec: r.resetSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(r.resetSec),
        "X-RateLimit-Limit": String(r.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + r.resetSec),
      },
    },
  );
}

/**
 * Extract a stable IP from a NextRequest. Falls back to "anon" so we never
 * throw if a header is missing in dev/preview.
 */
export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    // first hop is the client per Vercel/Cloudflare convention
    return fwd.split(",")[0].trim();
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anon";
}

/** Test-only: wipe all buckets between tests. */
export function __resetRateLimit(): void {
  BUCKETS.clear();
}
