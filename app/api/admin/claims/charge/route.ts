/**
 * POST /api/admin/claims/charge — V36 DEEL 1.
 *
 * Admin-only handmatige fee-charge voor de drie V35-claim-types
 * (Box3Claim, HuurServicekostenClaim, EnergieEindafrekeningClaim).
 *
 * Flow:
 *  1. ADMIN_EMAILS-gate (lib/admin_auth.isAdmin) — anders 403.
 *  2. Validate { type, claimId } — anders 400.
 *  3. Lees claim; vereis werkelijke-bedrag-veld en geschikte status
 *     (UITSPRAAK voor huur/energie; PROOF_RECEIVED of UITSPRAAK voor box3).
 *  4. Bereken fee via per-type-helper (lib/admin-claims.feeForClaim).
 *  5. chargeFeeOffSession (Stripe off-session). Bij succes: claim →
 *     CHARGED + feeCents + paymentIntentId + chargedAt.
 *  6. AdminAction-row geschreven onafhankelijk van Stripe-uitkomst
 *     (audit-trail bewaart óók fails — waarom + door wie).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { chargeFeeOffSession } from "@/lib/payments";
import {
  chargeActionFor,
  feeForClaim,
  validateAdminChargeRequest,
  type ClaimType,
} from "@/lib/admin-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const adminEmail = ((session.user as { email?: string }).email ?? "").toLowerCase();

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* falls through */
  }
  const validation = validateAdminChargeRequest(
    body as { type: unknown; claimId: unknown },
  );
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, reason: validation.reason },
      { status: 400 },
    );
  }
  const { type, claimId } = validation;

  // 1. Read claim + werkelijke-bedrag + status.
  const claim = await readClaim(type, claimId);
  if (!claim) {
    await logAction(adminEmail, type, claimId, { kind: "not-found" }, false, "claim not found");
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  if (claim.werkelijkeCents == null || claim.werkelijkeCents <= 0) {
    await logAction(
      adminEmail,
      type,
      claimId,
      { kind: "no-werkelijk", status: claim.status },
      false,
      "no werkelijk-amount set",
    );
    return NextResponse.json({ ok: false, reason: "no-werkelijk" }, { status: 422 });
  }
  if (claim.status === "CHARGED" || claim.status === "FAILED") {
    await logAction(
      adminEmail,
      type,
      claimId,
      { kind: "already-settled", status: claim.status },
      false,
      `claim already ${claim.status}`,
    );
    return NextResponse.json(
      { ok: false, reason: "already-settled", status: claim.status },
      { status: 409 },
    );
  }

  // 2. Bereken fee.
  const feeCents = feeForClaim(type, claim.werkelijkeCents);
  if (feeCents <= 0) {
    // Werkelijk onder per-type-drempel → claim direct als CHARGED met fee 0
    // (eerlijke uitkomst; nooit fee onder drempel).
    await updateClaimNoFee(type, claimId, claim.werkelijkeCents);
    await logAction(
      adminEmail,
      type,
      claimId,
      { kind: "no-fee", werkelijkeCents: claim.werkelijkeCents, feeCents: 0 },
      true,
      null,
    );
    return NextResponse.json({
      ok: true,
      kind: "no-fee",
      werkelijkeCents: claim.werkelijkeCents,
      feeCents: 0,
    });
  }

  // 3. Stripe off-session charge.
  const charge = await chargeFeeOffSession({
    userId: claim.userId,
    negotiationId: `${chargeActionFor(type)}-${claimId}`,
    feeCents,
  });
  if (!charge.ok) {
    await logAction(
      adminEmail,
      type,
      claimId,
      { kind: "charge-failed", feeCents, reason: charge.reason },
      false,
      charge.reason,
    );
    return NextResponse.json(
      { ok: false, reason: charge.reason, feeCents },
      { status: 502 },
    );
  }

  // 4. Persist CHARGED.
  await updateClaimCharged(type, claimId, claim.werkelijkeCents, feeCents, charge.paymentIntentId);
  await logAction(
    adminEmail,
    type,
    claimId,
    {
      kind: "charged",
      werkelijkeCents: claim.werkelijkeCents,
      feeCents,
      paymentIntentId: charge.paymentIntentId,
    },
    true,
    null,
  );
  return NextResponse.json({
    ok: true,
    paymentIntentId: charge.paymentIntentId,
    feeCents,
  });
}

// ─── Per-claim-type Prisma helpers ──────────────────────────────────────────

type ClaimSnapshot = {
  userId: string;
  status: string;
  werkelijkeCents: number | null;
};

async function readClaim(type: ClaimType, id: string): Promise<ClaimSnapshot | null> {
  if (type === "Box3Claim") {
    const c = await prisma.box3Claim.findUnique({
      where: { id },
      select: { userId: true, status: true, werkelijkTeruggaveCents: true },
    });
    if (!c) return null;
    return { userId: c.userId, status: c.status, werkelijkeCents: c.werkelijkTeruggaveCents };
  }
  if (type === "HuurServicekostenClaim") {
    const c = await prisma.huurServicekostenClaim.findUnique({
      where: { id },
      select: { userId: true, status: true, werkelijkeRestitutieCents: true },
    });
    if (!c) return null;
    return { userId: c.userId, status: c.status, werkelijkeCents: c.werkelijkeRestitutieCents };
  }
  // EnergieEindafrekeningClaim
  const c = await prisma.energieEindafrekeningClaim.findUnique({
    where: { id },
    select: { userId: true, status: true, werkelijkeRestitutieCents: true },
  });
  if (!c) return null;
  return { userId: c.userId, status: c.status, werkelijkeCents: c.werkelijkeRestitutieCents };
}

async function updateClaimCharged(
  type: ClaimType,
  id: string,
  werkelijkeCents: number,
  feeCents: number,
  paymentIntentId: string,
): Promise<void> {
  const now = new Date();
  if (type === "Box3Claim") {
    await prisma.box3Claim.update({
      where: { id },
      data: {
        status: "CHARGED",
        werkelijkTeruggaveCents: werkelijkeCents,
        chargedAt: now,
        feeCents,
        stripePaymentIntentId: paymentIntentId,
      },
    });
    return;
  }
  if (type === "HuurServicekostenClaim") {
    await prisma.huurServicekostenClaim.update({
      where: { id },
      data: {
        status: "CHARGED",
        werkelijkeRestitutieCents: werkelijkeCents,
        chargedAt: now,
        feeCents,
        stripePaymentIntentId: paymentIntentId,
      },
    });
    return;
  }
  await prisma.energieEindafrekeningClaim.update({
    where: { id },
    data: {
      status: "CHARGED",
      werkelijkeRestitutieCents: werkelijkeCents,
      chargedAt: now,
      feeCents,
      stripePaymentIntentId: paymentIntentId,
    },
  });
}

async function updateClaimNoFee(
  type: ClaimType,
  id: string,
  werkelijkeCents: number,
): Promise<void> {
  const now = new Date();
  if (type === "Box3Claim") {
    await prisma.box3Claim.update({
      where: { id },
      data: {
        status: "CHARGED",
        werkelijkTeruggaveCents: werkelijkeCents,
        chargedAt: now,
        feeCents: 0,
      },
    });
    return;
  }
  if (type === "HuurServicekostenClaim") {
    await prisma.huurServicekostenClaim.update({
      where: { id },
      data: {
        status: "CHARGED",
        werkelijkeRestitutieCents: werkelijkeCents,
        chargedAt: now,
        feeCents: 0,
      },
    });
    return;
  }
  await prisma.energieEindafrekeningClaim.update({
    where: { id },
    data: {
      status: "CHARGED",
      werkelijkeRestitutieCents: werkelijkeCents,
      chargedAt: now,
      feeCents: 0,
    },
  });
}

// ─── AdminAction audit-log ──────────────────────────────────────────────────

async function logAction(
  adminEmail: string,
  type: ClaimType,
  targetId: string,
  payload: Record<string, unknown>,
  ok: boolean,
  errorMessage: string | null,
): Promise<void> {
  try {
    await prisma.adminAction.create({
      data: {
        adminEmail,
        action: chargeActionFor(type),
        targetType: type,
        targetId,
        // Prisma wil InputJsonValue voor Json-columns; runtime-payloads zijn
        // platte string/number/boolean objecten, dus de cast is veilig.
        payloadJson: payload as unknown as object,
        ok,
        errorMessage,
      },
    });
  } catch {
    /* audit-log mag de hoofd-flow nooit breken */
  }
}
