/**
 * GET /api/cron/fraud-check — daily 04:30 UTC fraud-scoring sweep.
 *
 * Loops every non-suspended user, aggregates signals, computes
 * suspicionScore(), and writes a FraudFlag row when the score
 * crosses the 50-point threshold. Idempotent: existing unresolved
 * flags are not duplicated within the same cron run.
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import {
  suspicionScore,
  isFlaggable,
  type UserSignals,
} from "@/lib/fraud-detection";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockId = await acquireCronLock("fraud-check");
  if (!lockId) {
    return NextResponse.json({ ok: true, skipped: "already-running" });
  }

  let scanned = 0;
  let flagged = 0;
  let ok = true;
  try {
    const since = new Date(Date.now() - THIRTY_DAYS);
    const users = await prisma.user.findMany({
      where: { deletedAt: null, suspendedAt: null },
      select: {
        id: true,
        email: true,
        bills: { select: { imageHash: true, provider: true } },
        negotiations: {
          select: { state: true, proofVerifiedAt: true, closedAt: true },
        },
      },
      take: 2000,
    });

    for (const u of users) {
      scanned++;
      try {
        const totalClaims = u.negotiations.filter((n) => n.closedAt != null).length;
        const verifiedClaims = u.negotiations.filter((n) => n.proofVerifiedAt != null).length;
        const unverifiedClaims30d = u.negotiations.filter(
          (n) =>
            n.state === "SUCCESS_UNVERIFIED" &&
            n.closedAt != null &&
            n.closedAt >= since,
        ).length;

        // distinct providers + duplicate imageHashes
        const distinctProviders = new Set(u.bills.map((b) => b.provider)).size;
        const seenHash = new Map<string, number>();
        for (const b of u.bills) {
          if (!b.imageHash) continue;
          seenHash.set(b.imageHash, (seenHash.get(b.imageHash) ?? 0) + 1);
        }
        const duplicateImageHashes = [...seenHash.values()].filter((c) => c > 1).length;

        const signals: UserSignals = {
          email: u.email,
          unverifiedClaims30d,
          totalClaims,
          verifiedClaims,
          distinctProviders,
          duplicateImageHashes,
        };
        const result = suspicionScore(signals);
        if (!isFlaggable(result)) continue;

        // Skip when there's already an unresolved flag in the past 7d.
        const recent = await prisma.fraudFlag.findFirst({
          where: {
            userId: u.id,
            resolved: false,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          select: { id: true },
        });
        if (recent) continue;

        await prisma.fraudFlag.create({
          data: {
            userId: u.id,
            score: result.score,
            reasons: result.reasons.join("\n"),
          },
        });
        flagged++;
      } catch (e) {
        ok = false;
        Sentry.captureException(e, { tags: { module: "cron/fraud-check", userId: u.id } });
      }
    }
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: flagged, ok });
  }

  return NextResponse.json({ ok: true, scanned, flagged });
}
