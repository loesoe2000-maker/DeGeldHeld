import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { listAccounts, listTransactions, isPsd2Enabled } from "@/lib/psd2/tink";
import { detectRecurring } from "@/lib/psd2/detect-bills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPsd2Enabled()) return NextResponse.json({ error: "PSD2 not enabled" }, { status: 503 });
  const userId = (session.user as { id: string }).id;

  const conns = await prisma.bankConnection.findMany({
    where: { userId, status: "active" },
  });
  if (conns.length === 0) return NextResponse.json({ ok: true, detected: 0, note: "no-connections" });

  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let totalDetected = 0;

  for (const conn of conns) {
    try {
      const token = decryptToken(conn.accessTokenEnc);
      const accounts = await listAccounts(token);
      const allTx = [] as Awaited<ReturnType<typeof listTransactions>>;
      for (const acc of accounts) {
        const tx = await listTransactions(token, acc.id, fromDate);
        allTx.push(...tx);
      }
      const detected = detectRecurring(allTx);
      for (const d of detected) {
        await prisma.detectedRecurring.upsert({
          where: {
            // No unique constraint on (userId, counterpartyName) yet, so we use
            // a deterministic id via createMany-skip approach. Replace if duplicates appear.
            id: `${conn.id}-${Buffer.from(d.counterpartyName).toString("hex").slice(0, 24)}`,
          },
          create: {
            id: `${conn.id}-${Buffer.from(d.counterpartyName).toString("hex").slice(0, 24)}`,
            userId,
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
        totalDetected++;
      }
      await prisma.bankConnection.update({
        where: { id: conn.id },
        data: { lastSyncAt: new Date() },
      });
    } catch (e) {
      // mark expired/revoked if Tink rejected
      const msg = (e as Error).message;
      if (msg.includes("401") || msg.includes("403")) {
        await prisma.bankConnection.update({
          where: { id: conn.id },
          data: { status: "expired" },
        });
      }
    }
  }
  return NextResponse.json({ ok: true, detected: totalDetected });
}
