import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v19 DEEL 4 — auto off-session charge on verified savings + fallback.
 */

const h = vi.hoisted(() => ({
  // recordProof inputs
  charge: true,
  chargeResult: { ok: true, paymentIntentId: "pi_1" } as
    | { ok: true; paymentIntentId: string }
    | { ok: false; reason: string },
  feeCents: 6000,
  negUpdates: [] as Array<Record<string, unknown>>,
  mails: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    outcomeProof: { create: vi.fn(async () => ({ id: "proof_1" })) },
    negotiation: {
      findUnique: vi.fn(async () => ({
        userId: "u1",
        billId: "b1",
        user: { email: "a@b.nl" },
        // v30 fee-integrity: ENERGIE is een TYPE_A NCNP-categorie; deze fixture
        // moet de bill.category meeleveren omdat recordProof daarop gate't.
        bill: { category: "ENERGIE" },
      })),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.negUpdates.push(a.data);
        return {};
      }),
    },
  },
}));

vi.mock("@/lib/payments", () => ({
  feeForVerifiedSavings: () => h.feeCents,
  shouldChargeVerifiedFee: async () => h.charge,
  chargeFeeOffSession: async () => h.chargeResult,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (o: Record<string, unknown>) => {
    h.mails.push(o);
    return { id: "x", skipped: false };
  }),
}));

import { recordProof } from "@/lib/outcome-proof";

const verifiedInput = {
  negotiationId: "n1",
  kind: "new_bill" as const,
  newAmountCents: 2000, // €20 vs €30 → €10/mo saving → €120/yr verified
  oldMonthlyCents: 3000,
};

beforeEach(() => {
  h.charge = true;
  h.chargeResult = { ok: true, paymentIntentId: "pi_1" };
  h.feeCents = 6000;
  h.negUpdates = [];
  h.mails = [];
});

describe("v19 auto-fee charge on verified proof", () => {
  it("card + mandate + success → FEE_PAID, feePaidAt set, no fallback mail", async () => {
    h.chargeResult = { ok: true, paymentIntentId: "pi_99" };
    const { verdict } = await recordProof(verifiedInput);
    expect(verdict.verdict).toBe("verified");
    const d = h.negUpdates[0];
    expect(d.state).toBe("FEE_PAID");
    expect(d.feePaidAt).toBeInstanceOf(Date);
    expect(d.feePaymentIntentId).toBe("pi_99");
    expect(d.feeAmountCents).toBe(6000);
    expect(h.mails).toHaveLength(0);
  });

  it("card + mandate + off-session fail → BILLED_PENDING_PAYMENT + fallback mail", async () => {
    h.chargeResult = { ok: false, reason: "authentication_required" };
    await recordProof(verifiedInput);
    const d = h.negUpdates[0];
    expect(d.state).toBe("BILLED_PENDING_PAYMENT");
    expect(d.feeAmountCents).toBe(6000);
    expect(d.feePaidAt).toBeUndefined();
    expect(h.mails).toHaveLength(1);
    expect(String(h.mails[0].subject)).toMatch(/rond de fee af/i);
  });

  it("no card (charge fn returns no-card) → BILLED_PENDING_PAYMENT", async () => {
    h.chargeResult = { ok: false, reason: "no card on file" };
    await recordProof(verifiedInput);
    expect(h.negUpdates[0].state).toBe("BILLED_PENDING_PAYMENT");
  });

  it("admin / flag-off / sub-floor (no charge) → SUCCESS, no fee, no charge attempt", async () => {
    h.charge = false;
    await recordProof(verifiedInput);
    const d = h.negUpdates[0];
    expect(d.state).toBe("SUCCESS");
    expect(d.feeAmountCents).toBeNull();
    expect(h.mails).toHaveLength(0);
  });
});
