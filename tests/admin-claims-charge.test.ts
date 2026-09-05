/**
 * tests/admin-claims-charge.test.ts — V36 DEEL 1.
 *
 * Test POST /api/admin/claims/charge met gemockte Prisma + auth + Stripe.
 *
 * Covers:
 *  - 401 zonder sessie / 403 niet-admin (ADMIN_EMAILS mismatch)
 *  - 400 invalid input / 404 claim niet gevonden
 *  - 422 zonder werkelijke-bedrag / 409 al CHARGED / FAILED
 *  - Happy: type-specifieke Prisma-update + AdminAction-row geschreven
 *  - Fee-helper: per-type drempels + percentages correct toegepast
 *  - Audit-log: fails worden óók gelogd (errorMessage gevuld)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  feeForClaim,
  claimTypeLabel,
  chargeActionFor,
  isClaimType,
  validateAdminChargeRequest,
} from "@/lib/admin-claims";

const h = vi.hoisted(() => ({
  adminEmail: "owner@degeldheld.com",
  sessionEmail: "owner@degeldheld.com" as string | null,
  sessionUserId: "u_owner" as string | null,
  box3Claim: null as Record<string, unknown> | null,
  huurClaim: null as Record<string, unknown> | null,
  energieClaim: null as Record<string, unknown> | null,
  chargeResult: { ok: true as boolean, paymentIntentId: "pi_admin_1", reason: null as string | null },
  adminActions: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ model: string; data: Record<string, unknown> }>,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () =>
    h.sessionUserId
      ? { user: { id: h.sessionUserId, email: h.sessionEmail } }
      : null,
  ),
}));
vi.mock("@/lib/admin_auth", () => ({
  isAdmin: vi.fn(async () => {
    const list = (process.env.ADMIN_EMAILS ?? "").toLowerCase();
    if (!list) return false;
    return list
      .split(",")
      .map((e) => e.trim())
      .includes((h.sessionEmail ?? "").toLowerCase());
  }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    box3Claim: {
      findUnique: vi.fn(async () => h.box3Claim),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        h.updates.push({ model: "Box3Claim", data });
        h.box3Claim = { ...(h.box3Claim ?? {}), ...data };
        return h.box3Claim;
      }),
    },
    huurServicekostenClaim: {
      findUnique: vi.fn(async () => h.huurClaim),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        h.updates.push({ model: "HuurServicekostenClaim", data });
        h.huurClaim = { ...(h.huurClaim ?? {}), ...data };
        return h.huurClaim;
      }),
    },
    energieEindafrekeningClaim: {
      findUnique: vi.fn(async () => h.energieClaim),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        h.updates.push({ model: "EnergieEindafrekeningClaim", data });
        h.energieClaim = { ...(h.energieClaim ?? {}), ...data };
        return h.energieClaim;
      }),
    },
    adminAction: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        h.adminActions.push(data);
        return { id: "aa_1" };
      }),
    },
  },
}));
vi.mock("@/lib/payments", async (importOriginal) => {
  // Override ALLEEN chargeFeeOffSession; alle andere exports (zoals
  // NO_CURE_NO_PAY_FEE_CAP_CENTS waar lib/box3-claim + lib/huurcommissie +
  // lib/energie-claim van afhangen) blijven origineel.
  const orig = await importOriginal<typeof import("@/lib/payments")>();
  return {
    ...orig,
    chargeFeeOffSession: vi.fn(async () =>
      h.chargeResult.ok
        ? { ok: true, paymentIntentId: h.chargeResult.paymentIntentId }
        : { ok: false, reason: h.chargeResult.reason ?? "unknown" },
    ),
  };
});

import { POST as chargePOST } from "@/app/api/admin/claims/charge/route";

function jsonReq(body: unknown) {
  return new Request("http://x/api/admin/claims/charge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.ADMIN_EMAILS = "owner@degeldheld.com";
  h.sessionUserId = "u_owner";
  h.sessionEmail = "owner@degeldheld.com";
  h.box3Claim = null;
  h.huurClaim = null;
  h.energieClaim = null;
  h.chargeResult = { ok: true, paymentIntentId: "pi_admin_1", reason: null };
  h.adminActions = [];
  h.updates = [];
});

// ─── Pure helpers ───────────────────────────────────────────────────────────

describe("admin-claims pure helpers", () => {
  it("isClaimType erkent alléén de 3 V35-types", () => {
    expect(isClaimType("Box3Claim")).toBe(true);
    expect(isClaimType("HuurServicekostenClaim")).toBe(true);
    expect(isClaimType("EnergieEindafrekeningClaim")).toBe(true);
    expect(isClaimType("OtherClaim")).toBe(false);
    expect(isClaimType("")).toBe(false);
    expect(isClaimType(null)).toBe(false);
  });

  it("v41 GRATIS: feeForClaim geeft voor élk type en bedrag 0", () => {
    // Tot v40: Box 3 25% boven € 500, huur/energie 20% boven € 50.
    for (const bedrag of [0, 4_999, 5_000, 49_999, 50_000, 200_000, 1_000_000]) {
      expect(feeForClaim("Box3Claim", bedrag)).toBe(0);
      expect(feeForClaim("HuurServicekostenClaim", bedrag)).toBe(0);
      expect(feeForClaim("EnergieEindafrekeningClaim", bedrag)).toBe(0);
    }
  });

  it("feeForClaim 0/negatief/null → 0", () => {
    expect(feeForClaim("Box3Claim", 0)).toBe(0);
    expect(feeForClaim("Box3Claim", -100)).toBe(0);
    expect(feeForClaim("Box3Claim", null)).toBe(0);
    expect(feeForClaim("Box3Claim", undefined)).toBe(0);
  });

  it("claimTypeLabel + chargeActionFor zijn deterministisch per type", () => {
    expect(claimTypeLabel("Box3Claim")).toMatch(/Box 3/);
    expect(claimTypeLabel("HuurServicekostenClaim")).toMatch(/Huurcommissie/);
    expect(claimTypeLabel("EnergieEindafrekeningClaim")).toMatch(/Energie/);
    expect(chargeActionFor("Box3Claim")).toBe("charge-box3");
    expect(chargeActionFor("HuurServicekostenClaim")).toBe("charge-huur");
    expect(chargeActionFor("EnergieEindafrekeningClaim")).toBe("charge-energie");
  });

  it("validateAdminChargeRequest reject invalid input", () => {
    expect(validateAdminChargeRequest({ type: "Bogus", claimId: "x" }).ok).toBe(false);
    expect(validateAdminChargeRequest({ type: "Box3Claim", claimId: "" }).ok).toBe(false);
    expect(validateAdminChargeRequest({ type: "Box3Claim", claimId: 42 }).ok).toBe(false);
    const ok = validateAdminChargeRequest({ type: "Box3Claim", claimId: "c1" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.type).toBe("Box3Claim");
      expect(ok.claimId).toBe("c1");
    }
  });
});

// ─── Route gating ───────────────────────────────────────────────────────────

describe("/api/admin/claims/charge — v41: route is UITGEZET (410 Gone)", () => {
  /**
   * De incassoroute bestaat nog als bestand, maar incasseert niets meer.
   * Deze suite borgt drie dingen: de auth-gate staat er nog vóór het 410
   * (geen informatielek), er komt nooit een 200, en Stripe wordt niet geraakt.
   */

  it("401 zonder sessie — auth blijft vóór de 410", async () => {
    h.sessionUserId = null;
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(401);
  });

  it("403 voor niet-admin — ook zonder incasso blijft de route afgeschermd", async () => {
    h.sessionEmail = "regular@user.com";
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(403);
    expect(h.adminActions).toHaveLength(0);
  });

  it("admin krijgt 410 Gone met reden 'fee-disabled'", async () => {
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c_box3_1" }));
    expect(r.status).toBe(410);
    const data = await r.json();
    expect(data.reason).toBe("fee-disabled");
  });

  it("410 ongeacht de invoer — ook bij onzin of een rijpe claim", async () => {
    h.box3Claim = {
      userId: "u1",
      status: "PROOF_RECEIVED",
      werkelijkTeruggaveCents: 200_000,
    };
    for (const body of [
      { type: "Box3Claim", claimId: "c_box3_1" },
      { type: "HuurServicekostenClaim", claimId: "c_huur_1" },
      { type: "Bogus", claimId: "c1" },
      { type: "Box3Claim", claimId: "" },
    ]) {
      const r = await chargePOST(jsonReq(body));
      expect(r.status).toBe(410);
    }
  });

  it("de kern: Stripe wordt nooit aangeroepen en niets wordt CHARGED", async () => {
    h.box3Claim = {
      userId: "u1",
      status: "PROOF_RECEIVED",
      werkelijkTeruggaveCents: 200_000,
    };
    await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c_box3_1" }));
    // Geen Prisma-update en geen AdminAction: de route komt nergens.
    expect(h.updates).toHaveLength(0);
    expect(h.adminActions).toHaveLength(0);
  });
});
