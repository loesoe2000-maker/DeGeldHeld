import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CATEGORY_STRATEGY,
  categoryAllowsFee,
  categoryStrategyType,
} from "@/lib/category-strategy";

/**
 * v30 DEEL 3a — telecom-reframe (TELECOM van TYPE_A → TYPE_B, fee=false).
 * Fee-integrity: bevestigen dat TELECOM nooit een NCNP-fee triggert, en dat
 * de echte NCNP-categorieën (ENERGIE/BANK/SOFTWARE/ABONNEMENT) wél fee
 * mogen geven. Tegelijk verifieert een integration-test dat een gemockte
 * `recordProof` op een TELECOM-negotiation geen Stripe-call doet.
 */

describe("category-strategy — fee-integrity", () => {
  it("TELECOM → fee:false (TYPE_B advies)", () => {
    expect(CATEGORY_STRATEGY.TELECOM.fee).toBe(false);
    expect(CATEGORY_STRATEGY.TELECOM.strategy).toBe("TYPE_B_ADVIES");
    expect(categoryAllowsFee("TELECOM")).toBe(false);
    expect(categoryStrategyType("TELECOM")).toBe("TYPE_B_ADVIES");
  });

  it("ENERGIE / BANK / SOFTWARE / ABONNEMENT → fee:true (TYPE_A NCNP)", () => {
    for (const cat of ["ENERGIE", "BANK", "SOFTWARE", "ABONNEMENT"] as const) {
      expect(CATEGORY_STRATEGY[cat].fee).toBe(true);
      expect(CATEGORY_STRATEGY[cat].strategy).toBe("TYPE_A_NCNP");
      expect(categoryAllowsFee(cat)).toBe(true);
    }
  });

  it("Monopolies / AFM-gegate → fee:false (geen NCNP)", () => {
    for (const cat of ["WATER", "GEMEENTE", "VERZEKERING", "HYPOTHEEK"] as const) {
      expect(CATEGORY_STRATEGY[cat].fee).toBe(false);
    }
  });

  it("Streaming / Gym / OV / OPSLAG / OVERIG → advies, geen fee", () => {
    for (const cat of ["STREAMING", "GYM", "OV", "OPSLAG", "OVERIG"] as const) {
      expect(CATEGORY_STRATEGY[cat].fee).toBe(false);
      expect(CATEGORY_STRATEGY[cat].strategy).toBe("TYPE_B_ADVIES");
    }
  });

  it("élke entry heeft een note (uitleg waarom wel/geen fee)", () => {
    for (const cat of Object.keys(CATEGORY_STRATEGY) as Array<keyof typeof CATEGORY_STRATEGY>) {
      expect(CATEGORY_STRATEGY[cat].note.length).toBeGreaterThan(20);
    }
  });
});

// ─── Migratie-veiligheid: TELECOM-negotiation triggert geen retro-actieve fee ─

const h = vi.hoisted(() => ({
  neg: null as Record<string, unknown> | null,
  proofRow: null as Record<string, unknown> | null,
  feeChargeCalls: 0,
  negotiationUpdates: [] as Array<Record<string, unknown>>,
  mailsSent: 0,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    outcomeProof: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.proofRow = a.data;
        return { id: "proof_1", ...a.data };
      }),
    },
    negotiation: {
      findUnique: vi.fn(async () => h.neg),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.negotiationUpdates.push(a.data);
        return {};
      }),
    },
  },
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {
    h.mailsSent++;
    return { id: "x", skipped: false };
  }),
  escapeHtml: (s: string) => s,
}));
vi.mock("@/lib/payments", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/payments")>();
  return {
    ...orig,
    shouldChargeVerifiedFee: vi.fn(async () => true), // user is fee-eligible
    chargeFeeOffSession: vi.fn(async () => {
      h.feeChargeCalls++;
      return { ok: true as const, paymentIntentId: "pi_x" };
    }),
  };
});

import { recordProof } from "@/lib/outcome-proof";

beforeEach(() => {
  h.neg = null;
  h.proofRow = null;
  h.feeChargeCalls = 0;
  h.negotiationUpdates = [];
  h.mailsSent = 0;
});

describe("recordProof — TELECOM-negotiation triggert geen retro-actieve fee (v30)", () => {
  it("TELECOM + verified saving → SUCCESS i.p.v. FEE_PAID, geen chargeCall", async () => {
    h.neg = {
      userId: "u1",
      billId: "b1",
      user: { email: "x@y.nl" },
      bill: { category: "TELECOM" },
    };
    const r = await recordProof({
      negotiationId: "neg_1",
      kind: "manual",
      newAmountCents: 2000, // €20
      oldMonthlyCents: 4000, // €40 → 50% drop, ruim boven 5%
    });
    expect(r.verdict.verdict).toBe("verified");
    expect(h.feeChargeCalls).toBe(0);
    // Negotiation gaat naar SUCCESS (no-charge pad), niet FEE_PAID.
    const states = h.negotiationUpdates.map((u) => u.state).filter(Boolean);
    expect(states).toContain("SUCCESS");
    expect(states).not.toContain("FEE_PAID");
  });

  it("v41 GRATIS: ook ENERGIE levert geen incasso meer op (was: FEE_PAID)", async () => {
    h.neg = {
      userId: "u1",
      billId: "b1",
      user: { email: "x@y.nl" },
      bill: { category: "ENERGIE" },
    };
    await recordProof({
      negotiationId: "neg_2",
      kind: "manual",
      newAmountCents: 8000, // €80
      oldMonthlyCents: 12000, // €120 (33% drop)
    });
    // Tot v40 werd hier geïncasseerd en de onderhandeling op FEE_PAID gezet.
    // Het platform is nu gratis: geen enkele categorie triggert nog een charge.
    expect(h.feeChargeCalls).toBe(0);
    const states = h.negotiationUpdates.map((u) => u.state).filter(Boolean);
    expect(states).not.toContain("FEE_PAID");
  });
});
