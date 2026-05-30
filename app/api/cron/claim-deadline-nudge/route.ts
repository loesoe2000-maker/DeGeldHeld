/**
 * GET /api/cron/claim-deadline-nudge — v37.
 *
 * Dagelijkse deadline-bewaking voor open huur + energie claims. Per claim
 * bepaalt decideClaimNudge (pure) of er een nudge nodig is op basis van
 * status + createdAt/updatedAt + de officiële reactie-/behandeltermijnen.
 * Idempotent via lastNudgeKind: dezelfde nudge gaat nooit twee keer.
 *
 * Respecteert privacy: alleen users zonder marketingOptOut, met
 * notificationsEnabled, niet verwijderd. Mailt via Resend (sendEmail).
 *
 * Gated: authorizeCron (401) + CLAIM_DEADLINE_NUDGE_ENABLED (503).
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logCronEvent } from "@/lib/cron-auth";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { sendEmail } from "@/lib/email";
import { notifyOwner } from "@/lib/owner-alerts";
import { decideClaimNudge, formatClaimNudge, type ClaimForNudge } from "@/lib/claim-deadlines";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 200;
// Open statussen die nog een nudge kunnen krijgen (CHARGED/FAILED niet).
const OPEN_HUUR = ["INTENT", "BEZWAAR_GESTUURD", "HUURCOMMISSIE_INGEDIEND"];
const OPEN_ENERGIE = ["INTENT", "KLACHT_GESTUURD", "GESCHILLENCOMMISSIE_INGEDIEND"];

type Row = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastNudgeKind: string | null;
  user: { email: string | null; marketingOptOut: boolean; notificationsEnabled: boolean; deletedAt: Date | null };
};

function mayMail(u: Row["user"]): boolean {
  return (
    !!u.email && !u.marketingOptOut && u.notificationsEnabled && u.deletedAt == null
  );
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEnabled("CLAIM_DEADLINE_NUDGE_ENABLED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }
  const lockId = await acquireCronLock("claim-deadline-nudge");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  logCronEvent("claim-deadline-nudge", "start");
  const now = new Date();
  let scanned = 0;
  let nudged = 0;
  let errors = 0;

  const userSelect = {
    email: true,
    marketingOptOut: true,
    notificationsEnabled: true,
    deletedAt: true,
  } as const;

  try {
    const [huur, energie] = await Promise.all([
      prisma.huurServicekostenClaim.findMany({
        where: { status: { in: OPEN_HUUR } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          lastNudgeKind: true,
          user: { select: userSelect },
        },
        take: BATCH_LIMIT,
      }) as Promise<Row[]>,
      prisma.energieEindafrekeningClaim.findMany({
        where: { status: { in: OPEN_ENERGIE } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          lastNudgeKind: true,
          user: { select: userSelect },
        },
        take: BATCH_LIMIT,
      }) as Promise<Row[]>,
    ]);

    const work: Array<{ row: Row; soort: "huur" | "energie" }> = [
      ...huur.map((row) => ({ row, soort: "huur" as const })),
      ...energie.map((row) => ({ row, soort: "energie" as const })),
    ];

    for (const { row, soort } of work) {
      scanned++;
      const claim: ClaimForNudge = {
        id: row.id,
        soort,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastNudgeKind: row.lastNudgeKind,
      };
      const kind = decideClaimNudge(claim, now);
      if (!kind) continue;
      if (!mayMail(row.user)) {
        // Stempel toch zodat we niet elke dag opnieuw evalueren; geen mail.
        await stamp(soort, row.id, kind, now);
        continue;
      }
      try {
        const mail = formatClaimNudge(kind, soort, row.id);
        await sendEmail({
          to: row.user.email as string,
          subject: mail.subject,
          text: mail.text,
          html: `<pre style="font-family:inherit;white-space:pre-wrap">${mail.text}</pre>`,
        });
        await stamp(soort, row.id, kind, now);
        nudged++;
      } catch (mailErr) {
        errors++;
        Sentry.captureException(mailErr, {
          tags: { cron: "claim-deadline-nudge", soort, stage: "mail" },
        });
      }
    }
  } catch (e) {
    errors++;
    Sentry.captureException(e, { tags: { cron: "claim-deadline-nudge", stage: "scan" } });
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: nudged, ok: errors === 0 });
  }

  logCronEvent("claim-deadline-nudge", "done", { scanned, nudged, errors });
  if (errors > 0) {
    void notifyOwner("cron-failed", {
      summary: `claim-deadline-nudge finished with ${errors} error(s)`,
      ref: `claim-deadline-nudge:${now.toISOString().slice(0, 10)}`,
      details: { scanned, nudged, errors },
    });
  }
  return NextResponse.json({ scanned, nudged, errors });
}

/** Schrijf lastNudgeKind + lastNudgeAt op de juiste tabel. */
async function stamp(
  soort: "huur" | "energie",
  id: string,
  kind: string,
  at: Date,
): Promise<void> {
  if (soort === "huur") {
    await prisma.huurServicekostenClaim.update({
      where: { id },
      data: { lastNudgeKind: kind, lastNudgeAt: at },
    });
  } else {
    await prisma.energieEindafrekeningClaim.update({
      where: { id },
      data: { lastNudgeKind: kind, lastNudgeAt: at },
    });
  }
}
