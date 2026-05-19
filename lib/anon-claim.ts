/**
 * lib/anon-claim.ts — v15 DEEL 3 claim-on-signup helpers.
 *
 * When an anonymous visitor signs up, every Bill tagged with their
 * dgh_anon_session cookie is reassigned to the new user.id. Pure
 * function (just wraps a single Prisma updateMany) so the cleanup
 * cron + the NextAuth event handler can share the same code path.
 */

import { prisma } from "@/lib/db";
import { isValidAnonSessionId } from "@/lib/anon-session";

export type ClaimResult = {
  claimed: number;
  firstBillId: string | null;
};

/**
 * Reassign all anonymous bills under `sessionId` to `userId`.
 * Idempotent: subsequent calls with the same arguments are a no-op.
 *
 * Returns the count plus the id of the most recently created bill so
 * the caller can redirect into /onderhandel/email?bill=X.
 */
export async function claimAnonymousBills(
  userId: string,
  sessionId: string | null | undefined,
  email?: string | null,
): Promise<ClaimResult> {
  // v15.1: claim by session-cookie OR by stamped anonymous email.
  // The email branch covers the cross-browser case (upload in incognito,
  // magic-link opens in default browser). Either branch is sufficient.
  const validSid = isValidAnonSessionId(sessionId);
  const sid = validSid ? (sessionId as string) : null;
  const normalizedEmail = email?.trim().toLowerCase() || null;
  if (!sid && !normalizedEmail) {
    return { claimed: 0, firstBillId: null };
  }

  const orClauses: Array<Record<string, unknown>> = [];
  if (sid) orClauses.push({ anonymousSessionId: sid });
  if (normalizedEmail) orClauses.push({ anonymousEmail: normalizedEmail });

  const where = { userId: null, OR: orClauses };

  const bills = await prisma.bill.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (bills.length === 0) return { claimed: 0, firstBillId: null };
  await prisma.bill.updateMany({
    where,
    data: {
      userId,
      anonymousSessionId: null,
      anonymousEmail: null,
      claimedAt: new Date(),
    },
  });
  return { claimed: bills.length, firstBillId: bills[0].id };
}

/**
 * Delete anonymous bills older than `maxAgeHours` that were never
 * claimed. Called by the daily cleanup cron.
 */
export async function deleteStaleAnonymousBills(
  maxAgeHours: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);
  const r = await prisma.bill.deleteMany({
    where: {
      anonymousSessionId: { not: null },
      userId: null,
      createdAt: { lt: cutoff },
    },
  });
  return r.count;
}
