/**
 * lib/turnstile.ts — Cloudflare Turnstile (CAPTCHA) verification.
 *
 * Graceful fallback contract: when TURNSTILE_SECRET_KEY is unset
 * (dev / unconfigured prod), verifyTurnstileToken() returns
 * { ok: true, skipped: true } so no flow is blocked by missing
 * config. This is a deliberate choice — Turnstile is an extra
 * defence-in-depth layer on top of rate-limiting and the honeypot,
 * not the only gate.
 *
 * Once the user adds the secret to Vercel env, verification kicks
 * in automatically; no code change required.
 */

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerdict =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: string };

/** Test-seam: override the fetch used to call Cloudflare's API. */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
let _fetchImpl: FetchLike = (input, init) => fetch(input, init);

export function __setFetchImpl(fn: FetchLike | null): void {
  _fetchImpl = fn ?? ((input, init) => fetch(input, init));
}

/**
 * Verify a Turnstile token. Returns:
 *   - { ok: true, skipped: true } when no secret is configured
 *     (graceful fallback so dev / fresh prod isn't blocked).
 *   - { ok: true } when Cloudflare confirms the token.
 *   - { ok: false, reason } otherwise.
 *
 * Never throws — network/JSON errors collapse to ok=false so the
 * caller can decide whether to allow the request.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!secret) {
    return { ok: true, skipped: true };
  }
  if (!token || token.length < 4) {
    return { ok: false, reason: "missing token" };
  }
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  let resp: Response;
  try {
    resp = await _fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    return { ok: false, reason: `network: ${(e as Error).message}` };
  }
  if (!resp.ok) return { ok: false, reason: `http ${resp.status}` };
  let parsed: unknown;
  try {
    parsed = await resp.json();
  } catch {
    return { ok: false, reason: "bad json" };
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (obj.success === true) return { ok: true };
  const errors = Array.isArray(obj["error-codes"])
    ? (obj["error-codes"] as unknown[]).map(String).join(",")
    : "unknown";
  return { ok: false, reason: `cloudflare: ${errors}` };
}
