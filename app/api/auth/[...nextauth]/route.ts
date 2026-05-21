import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { looksLikeBotUserAgent } from "@/lib/anti-bot";

export const runtime = "nodejs";

// GET verifies the magic link and serves csrf/session/providers — it never
// sends mail, so it passes through untouched.
export const GET = handlers.GET;

/**
 * Magic-link send hardening (pre-launch abuse defence).
 *
 * `signIn("resend", …)` from the public /login form POSTs the email to
 * `/api/auth/signin/resend` — the ONE endpoint that triggers a Resend send.
 * Gating it here covers *every* send, including scripted hits that skip our
 * form (which a client-side guard cannot). Without this the public login
 * could email-bomb arbitrary inboxes or burn the Resend free-tier quota.
 *
 * The error responses carry an absolute `url` because next-auth/react always
 * does `await res.json()` and then navigates to / returns `data.url`. Pointing
 * it at `/login?error=…` lets the form surface a clear message (see
 * app/login/page.tsx → mapAuthError).
 */
const SEND_PATH = "/signin/resend";

export async function POST(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname.endsWith(SEND_PATH)) {
    // Obvious automation never runs our client JS — refuse it outright.
    if (looksLikeBotUserAgent(req.headers.get("user-agent"))) {
      return gateResponse(url.origin, "blocked", 403);
    }
    // Per-IP cap: 5/hour mirrors our other anonymous endpoints and stays
    // invisible to real users (one login = one send).
    const rl = rateLimit({ key: `magic-link:${ipFromRequest(req)}`, max: 5, windowSec: 3600 });
    if (!rl.ok) return gateResponse(url.origin, "rate_limited", 429, rl.resetSec);
  }
  return handlers.POST(req);
}

function gateResponse(
  origin: string,
  code: "blocked" | "rate_limited",
  status: number,
  retryAfterSec?: number,
): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return new Response(
    JSON.stringify({
      url: `${origin}/login?error=${code}`,
      error: code,
      ...(retryAfterSec ? { retryAfterSec } : {}),
    }),
    { status, headers },
  );
}
