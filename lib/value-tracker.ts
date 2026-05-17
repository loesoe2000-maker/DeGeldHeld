/**
 * Value tracker — schat de huidige bedrijfswaarde van DeGeldHeld op basis
 * van traction-metrics uit de DB.
 *
 * Methodologie (pre-PMF, indie-acquisition benchmark):
 *  - Base value: €5.000 (werkende MVP code+brand+domain)
 *  - + €120 per actieve user (laatste 30d ingelogd of upload)
 *  - + €600 per betalende user lifetime
 *  - + ARR (annualized MRR) × 8 (SaaS multiple voor pre-PMF)
 *  - + €4.000 per geslaagde negotiation (proof asset)
 *  - + €5.000 per pers-mention (handmatige boost via env-var TRACTION_PRESS_COUNT)
 *  - + €5.000 per partnership (env-var TRACTION_PARTNERSHIPS)
 *
 * Brackets:
 *  pre-revenue 0-50 users      → €3k-€10k    (asset-sale niveau)
 *  early 50-500 users          → €10k-€80k   (validated MVP)
 *  growing 500-5000 users      → €80k-€500k  (proven traction)
 *  scaling 5000+ users         → €500k-€5M+  (acquisition target)
 */

import { prisma } from "@/lib/db";

export type ValueBreakdown = {
  baseValue: number;
  fromActiveUsers: number;
  fromPayingUsers: number;
  fromArr: number;
  fromSuccesses: number;
  fromPress: number;
  fromPartnerships: number;
  total: number;
  bracket: "asset" | "early" | "growing" | "scaling";
  bracketLabel: string;
};

export type TractionMetrics = {
  totalUsers: number;
  activeUsersLast30d: number;
  payingUsers: number;
  mrrCents: number;
  arrCents: number;
  successfulNegotiations: number;
  totalSavedCents: number;
  pressMentions: number;
  partnerships: number;
};

const BASE_VALUE_EUR = 5_000;
const PER_ACTIVE_USER_EUR = 120;
const PER_PAYING_USER_EUR = 600;
const ARR_MULTIPLE = 8;
const PER_SUCCESS_EUR = 40;       // 100 successen = €4.000 (proof-asset)
const PER_PRESS_EUR = 5_000;
const PER_PARTNERSHIP_EUR = 5_000;

function bracketFor(total: number, users: number): { bracket: ValueBreakdown["bracket"]; label: string } {
  if (users < 50) return { bracket: "asset", label: "Asset-sale niveau (€3k–€10k)" };
  if (users < 500) return { bracket: "early", label: "Validated MVP (€10k–€80k)" };
  if (users < 5_000) return { bracket: "growing", label: "Proven traction (€80k–€500k)" };
  return { bracket: "scaling", label: "Acquisition target (€500k–€5M+)" };
}

export async function gatherTraction(): Promise<TractionMetrics> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const totalUsers = await prisma.user.count();

  // "Actief" = upload of negotiation activity in last 30d, of laatst-ingelogd
  // (we hebben geen lastLoginAt → fallback op recent bill/negotiation/round activity)
  const activeUsersLast30d = await prisma.user.count({
    where: {
      OR: [
        { bills: { some: { createdAt: { gte: thirtyDaysAgo } } } },
        { negotiations: { some: { createdAt: { gte: thirtyDaysAgo } } } },
      ],
    },
  });

  // Paying = users met minimaal 1 PAID Payment
  const payingUsers = await prisma.user.count({
    where: { payments: { some: { status: "PAID" } } },
  });

  // MRR = paid payments in laatste 30d, geannualiseerd
  const recentPaid = await prisma.payment.findMany({
    where: { status: "PAID", createdAt: { gte: thirtyDaysAgo } },
    select: { amountCents: true },
  });
  const mrrCents = recentPaid.reduce((a, p) => a + p.amountCents, 0);
  const arrCents = mrrCents * 12;

  // Geslaagde onderhandelingen = state in {SUCCESS, BILLED, ACCEPTED}
  const successfulNegotiations = await prisma.negotiation.count({
    where: { state: { in: ["SUCCESS", "BILLED", "ACCEPTED"] } },
  });

  // Totaal bespaard (voor display, niet voor valuation direct)
  const successRows = await prisma.negotiation.findMany({
    where: { state: { in: ["SUCCESS", "BILLED", "ACCEPTED"] } },
    select: { actualSavingsCents: true, expectedSavingsCents: true },
  });
  const totalSavedCents = successRows.reduce(
    (a, n) => a + (n.actualSavingsCents ?? n.expectedSavingsCents ?? 0),
    0,
  );

  // Pers + partnerships via env (handmatig bij te houden)
  const pressMentions = Number(process.env.TRACTION_PRESS_COUNT ?? "0");
  const partnerships = Number(process.env.TRACTION_PARTNERSHIPS ?? "0");

  return {
    totalUsers,
    activeUsersLast30d,
    payingUsers,
    mrrCents,
    arrCents,
    successfulNegotiations,
    totalSavedCents,
    pressMentions: Number.isFinite(pressMentions) ? pressMentions : 0,
    partnerships: Number.isFinite(partnerships) ? partnerships : 0,
  };
}

export function computeValue(t: TractionMetrics): ValueBreakdown {
  const fromActiveUsers = t.activeUsersLast30d * PER_ACTIVE_USER_EUR;
  const fromPayingUsers = t.payingUsers * PER_PAYING_USER_EUR;
  const fromArr = Math.round((t.arrCents / 100) * ARR_MULTIPLE);
  const fromSuccesses = t.successfulNegotiations * PER_SUCCESS_EUR;
  const fromPress = t.pressMentions * PER_PRESS_EUR;
  const fromPartnerships = t.partnerships * PER_PARTNERSHIP_EUR;
  const total =
    BASE_VALUE_EUR +
    fromActiveUsers +
    fromPayingUsers +
    fromArr +
    fromSuccesses +
    fromPress +
    fromPartnerships;
  const { bracket, label } = bracketFor(total, t.totalUsers);
  return {
    baseValue: BASE_VALUE_EUR,
    fromActiveUsers,
    fromPayingUsers,
    fromArr,
    fromSuccesses,
    fromPress,
    fromPartnerships,
    total,
    bracket,
    bracketLabel: label,
  };
}

export function formatEur(eur: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(eur);
}
