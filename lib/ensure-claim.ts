/**
 * lib/ensure-claim.ts — page-level safety net for anonymous-bill claiming.
 *
 * NextAuth's events.createUser and events.signIn fire in fire-and-forget
 * mode; in production those handlers sometimes lose access to the
 * request cookies (serverless edge → node boundary) so the anon cookie
 * is never read and the bill is never claimed.
 *
 * This helper is called explicitly from server components on every page
 * an authenticated user could land on after magic-link signup
 * (/dashboard, /onderhandel, /onderhandel/analyse, /onderhandel/email).
 * If the user is logged in AND still carries an anon cookie, it claims
 * the bills, wipes the cookie, and returns the result so the page can
 * redirect into the right next step.
 *
 * Safe to call multiple times: the underlying updateMany is idempotent.
 */

import { cookies } from "next/headers";
import { ANON_COOKIE_NAME, isValidAnonSessionId } from "@/lib/anon-session";
import { claimAnonymousBills, type ClaimResult } from "@/lib/anon-claim";

export async function ensureBillsClaimed(
  userId: string | null | undefined,
  userEmail?: string | null,
): Promise<ClaimResult> {
  if (!userId) return { claimed: 0, firstBillId: null };
  const jar = await cookies();
  const sid = jar.get(ANON_COOKIE_NAME)?.value;
  const sidValid = isValidAnonSessionId(sid);
  // v15.1: even without a cookie we can still claim by email — the
  // email-signup endpoint stamped it on the anonymous bills. So this
  // helper is now useful for cross-browser magic-link clicks too.
  if (!sidValid && !userEmail) {
    return { claimed: 0, firstBillId: null };
  }
  try {
    const result = await claimAnonymousBills(userId, sidValid ? sid : null, userEmail);
    if (result.claimed > 0 && sidValid) {
      jar.set(ANON_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    }
    return result;
  } catch {
    return { claimed: 0, firstBillId: null };
  }
}
