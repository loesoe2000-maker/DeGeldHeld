import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { listAccounts, listTransactions, isPsd2Enabled } from "@/lib/psd2/tink";
import { detectRecurring } from "@/lib/psd2/detect-bills";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPsd2Enabled()) {
    return NextResponse.json({ ok: true, skipped: "psd2-disabled" });
  }

  const lockId = await acquireCronLock("psd2-sync");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  const conns = await prisma.bankConnection.findMany({
    where: { status: "active" },
    take: 100,
  });

  let synced = 0;
  let detected = 0;
  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const conn of conns) {
    try {
      const token = decryptToken(conn.accessTokenEnc);
      const accounts = await listAccounts(token);
      const allTx = [] as Awaited<ReturnType<typeof listTransactions>>;
      for (const acc of accounts) {
        const tx = await listTransactions(token, acc.id, fromDate);
        allTx.push(...tx);
      }
      const found = detectRecurring(allTx);
      for (const d of found) {
        await prisma.detectedRecurring.upsert({
          where: {
            id: `${conn.id}-${Buffer.from(d.counterpartyName).toString("hex").slice(0, 24)}`,
          },
          create: {
            id: `${conn.id}-${Buffer.from(d.counterpartyName).toString("hex").slice(0, 24)}`,
            userId: conn.userId,
            bankConnectionId: conn.id,
            counterpartyName: d.counterpartyName,
            monthlyCents: d.monthlyCents,
            category: d.category,
            lastSeenAt: d.lastSeenAt,
            occurrences: d.occurrences,
          },
          update: {
            monthlyCents: d.monthlyCents,
            lastSeenAt: d.lastSeenAt,
            occurrences: d.occurrences,
          },
        });
        detected++;
      }
      await prisma.bankConnection.update({
        where: { id: conn.id },
        data: { lastSyncAt: new Date() },
      });
      synced++;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("401") || msg.includes("403")) {
        await prisma.bankConnection.update({
          where: { id: conn.id },
          data: { status: "expired" },
        });
      }
      Sentry.captureException(e, {
        tags: { module: "cron/psd2-sync", connectionId: conn.id },
      });
    }
  }
  await releaseCronLock({ id: lockId, itemsProcessed: detected, ok: true });
  return NextResponse.json({ ok: true, conns: conns.length, synced, detected });
}
