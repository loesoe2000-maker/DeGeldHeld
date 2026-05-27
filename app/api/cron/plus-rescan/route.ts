/**
 * GET /api/cron/plus-rescan — v30 DEEL 2.
 *
 * Maandelijkse cron (vercel.json: "0 7 1 * *") die alle actieve Plus-users
 * door `runRescanForUser` haalt. Bij niet-lege delta → Resend-mail +
 * persisteer een `PlusRescan`-record. Gated door `PLUS_RESCAN_CRON_ENABLED`
 * (503 als uit) en `authorizeCron` (401 zonder secret).
 *
 * Géén verzonnen cijfers: élke finding komt uit een echte check-engine
 * (estimateBenefits / estimateBox3Restitution / estimateZorgkostenAftrek) of
 * uit detectWaste op de bestaande bills.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { authorizeCron, logCronEvent } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { notifyOwner } from "@/lib/owner-alerts";
import * as Sentry from "@sentry/nextjs";
import {
  runRescanForUser,
  type RescanFinding,
} from "@/lib/plus-rescan";
import { detectWaste, type WasteBill } from "@/lib/waste-detection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bouw "huidige" findings voor één user op uit beschikbare DB-signalen. */
async function buildCurrentFindings(userId: string): Promise<RescanFinding[]> {
  const findings: RescanFinding[] = [];

  // 1) Spookabonnementen — uit huidige Bill-set.
  const bills = await prisma.bill.findMany({
    where: { userId },
    select: { id: true, provider: true, category: true, monthlyCents: true, amountCents: true },
  });
  const waste = detectWaste(bills as WasteBill[]);
  for (const w of waste) {
    findings.push({
      kind: "spookabonnement",
      id: `waste:${w.id}`,
      label: w.title,
      maandIndicatieCents: w.monthlyTotalCents,
    });
  }

  // 2) Box 3 — open claims (niet CHARGED/FAILED) → er ligt geld klaar.
  const openClaims = await prisma.box3Claim.findMany({
    where: { userId, status: { in: ["INTENT", "AWAITING_PROOF", "PROOF_RECEIVED"] } },
    select: { id: true, jaar: true, verwachteTeruggaveCents: true, status: true },
  });
  for (const c of openClaims) {
    findings.push({
      kind: "box3",
      id: `box3:${c.id}`,
      label: `Box 3 ${c.jaar} — claim staat op ${c.status}`,
      maandIndicatieCents: null,
    });
  }

  // 3) v36 — Huurcommissie servicekosten-bezwaar. Open = elke status behalve
  //    CHARGED/FAILED. Geen maandbedrag (eenmalige restitutie).
  const openHuur = await prisma.huurServicekostenClaim.findMany({
    where: {
      userId,
      status: { in: ["INTENT", "BEZWAAR_GESTUURD", "HUURCOMMISSIE_INGEDIEND", "UITSPRAAK"] },
    },
    select: { id: true, boekjaar: true, status: true },
  });
  for (const c of openHuur) {
    findings.push({
      kind: "huurcommissie",
      id: `huur:${c.id}`,
      label: `Huurcommissie ${c.boekjaar} — claim staat op ${c.status}`,
      maandIndicatieCents: null,
    });
  }

  // 4) v36 — Energie-eindafrekening. Open = elke status behalve CHARGED/FAILED.
  //    Geen maandbedrag (eenmalige correctie).
  const openEnergie = await prisma.energieEindafrekeningClaim.findMany({
    where: {
      userId,
      status: { in: ["INTENT", "KLACHT_GESTUURD", "GESCHILLENCOMMISSIE_INGEDIEND", "UITSPRAAK"] },
    },
    select: { id: true, provider: true, status: true },
  });
  for (const c of openEnergie) {
    findings.push({
      kind: "energie_claim",
      id: `energie:${c.id}`,
      label: `Energie-claim @ ${c.provider} — claim staat op ${c.status}`,
      maandIndicatieCents: null,
    });
  }

  // 5) Toeslagen + zorgkosten — vergt user-input die we niet opslaan
  //    (privacy by design uit V29). Plus-cron noemt deze als "her-check
  //    via /geld-check + /zorgkosten-check"-reminder zonder eigen cijfers.
  //    Geen findings.push hier — de cron mailt nooit "we hebben €X
  //    gevonden" zonder verifieerbare basis.

  return findings;
}

/** Vorige snapshot voor delta-berekening. */
async function fetchPreviousFindings(userId: string): Promise<RescanFinding[]> {
  const last = await prisma.plusRescan.findFirst({
    where: { userId },
    orderBy: { runAt: "desc" },
  });
  if (!last) return [];
  const raw = last.findingsJson as { snapshot?: unknown } | null;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.snapshot)) return [];
  return raw.snapshot as RescanFinding[];
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEnabled("PLUS_RESCAN_CRON_ENABLED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }

  logCronEvent("plus-rescan", "start");

  const users = await prisma.user.findMany({
    where: {
      subscriptionStatus: "active",
      marketingOptOut: false,
      deletedAt: null,
    },
    select: { id: true, email: true },
  });

  let scanned = 0;
  let notified = 0;
  let errors = 0;

  for (const u of users) {
    scanned++;
    try {
      const previous = await fetchPreviousFindings(u.id);
      const current = await buildCurrentFindings(u.id);
      const result = runRescanForUser({
        userId: u.id,
        previousFindings: previous,
        currentFindings: current,
      });

      // Snapshot van de current set persisteren — diff-base voor volgende run.
      await prisma.plusRescan.create({
        data: {
          userId: u.id,
          findingsJson: {
            snapshot: current,
            delta: result.delta,
          },
        },
      });

      if (result.shouldNotify && u.email && result.mail) {
        try {
          await sendEmail({
            to: u.email,
            subject: result.mail.subject,
            text: result.mail.text,
            html: `<pre style="font-family:inherit;white-space:pre-wrap">${result.mail.text}</pre>`,
          });
          // notifiedAt op de zojuist aangemaakte rescan-record schrijven.
          await prisma.plusRescan.updateMany({
            where: { userId: u.id, notifiedAt: null },
            data: { notifiedAt: new Date() },
          });
          notified++;
        } catch (mailErr) {
          errors++;
          Sentry.captureException(mailErr, { tags: { cron: "plus-rescan", stage: "mail" } });
        }
      }
    } catch (e) {
      errors++;
      Sentry.captureException(e, { tags: { cron: "plus-rescan", stage: "user" } });
    }
  }

  logCronEvent("plus-rescan", "done", { scanned, notified, errors });
  // v36 — owner-alert wanneer cron-run errors had. Eén mail per run (dedup
  // op job-naam + date) zodat 14 failing users niet → 14 mails uitsturen.
  if (errors > 0) {
    void notifyOwner("cron-failed", {
      summary: `plus-rescan finished with ${errors} error(s)`,
      ref: `plus-rescan:${new Date().toISOString().slice(0, 10)}`,
      details: { scanned, notified, errors },
    });
  }
  return NextResponse.json({ scanned, notified, errors });
}
