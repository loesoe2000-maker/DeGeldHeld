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
): Promise<ClaimResult> {
  if (!userId) return { claimed: 0, firstBillId: null };
  const jar = await cookies();
  const sid = jar.get(ANON_COOKIE_NAME)?.value;
  if (!isValidAnonSessionId(sid)) {
    return { claimed: 0, firstBillId: null };
  }
  try {
    const result = await claimAnonymousBills(userId, sid);
    if (result.claimed > 0) {
      // Cookie has served its purpose — clear it so subsequent
      // page loads don't waste a Prisma query.
      jar.set(ANON_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    }
    return result;
  } catch {
    // Claim failed — don't block the page render, the user can
    // still navigate manually. Cron will eventually clean up.
    return { claimed: 0, firstBillId: null };
  }
}
