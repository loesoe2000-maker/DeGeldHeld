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
): Promise<ClaimResult> {
  if (!isValidAnonSessionId(sessionId)) {
    return { claimed: 0, firstBillId: null };
  }
  const sid = sessionId as string;
  const bills = await prisma.bill.findMany({
    where: { anonymousSessionId: sid, userId: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (bills.length === 0) return { claimed: 0, firstBillId: null };
  await prisma.bill.updateMany({
    where: { anonymousSessionId: sid, userId: null },
    data: { userId, anonymousSessionId: null, claimedAt: new Date() },
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
