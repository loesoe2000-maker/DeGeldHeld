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

  it("feeForClaim past de juiste per-type drempel + percentage toe", () => {
    // Box 3: drempel € 500 (50_000), 25%
    expect(feeForClaim("Box3Claim", 49_999)).toBe(0);
    expect(feeForClaim("Box3Claim", 50_000)).toBe(12_500); // 25% × € 500
    expect(feeForClaim("Box3Claim", 200_000)).toBe(50_000); // 25% × € 2.000 = NCNP-cap

    // Huurcommissie: drempel € 50 (5_000), 20%
    expect(feeForClaim("HuurServicekostenClaim", 4_999)).toBe(0);
    expect(feeForClaim("HuurServicekostenClaim", 5_000)).toBe(1_000); // 20% × € 50
    expect(feeForClaim("HuurServicekostenClaim", 20_000)).toBe(4_000); // 20% × € 200

    // Energie: drempel € 50 (5_000), 20%
    expect(feeForClaim("EnergieEindafrekeningClaim", 4_999)).toBe(0);
    expect(feeForClaim("EnergieEindafrekeningClaim", 5_000)).toBe(1_000);
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

describe("/api/admin/claims/charge — gating", () => {
  it("401 zonder sessie", async () => {
    h.sessionUserId = null;
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(401);
  });

  it("403 voor niet-admin user", async () => {
    h.sessionEmail = "regular@user.com";
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(403);
    // AdminAction NIET geschreven — auth-fail komt vóór audit-log.
    expect(h.adminActions).toHaveLength(0);
  });

  it("400 bij invalid input (type onbekend)", async () => {
    const r = await chargePOST(jsonReq({ type: "Bogus", claimId: "c1" }));
    expect(r.status).toBe(400);
  });

  it("400 bij invalid input (claimId leeg)", async () => {
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "" }));
    expect(r.status).toBe(400);
  });
});

// ─── Route happy path + audit-log ───────────────────────────────────────────

describe("/api/admin/claims/charge — Box3Claim charge", () => {
  beforeEach(() => {
    h.box3Claim = {
      userId: "u1",
      status: "PROOF_RECEIVED",
      werkelijkTeruggaveCents: 200_000, // € 2.000 → fee € 500 (cap)
    };
  });

  it("happy: 200 + Prisma update CHARGED + AdminAction ok=true", async () => {
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c_box3_1" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.feeCents).toBe(50_000); // NCNP-cap
    expect(data.paymentIntentId).toBe("pi_admin_1");

    // Claim is CHARGED met fee + paymentIntent.
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].model).toBe("Box3Claim");
    expect(h.updates[0].data).toMatchObject({
      status: "CHARGED",
      feeCents: 50_000,
      stripePaymentIntentId: "pi_admin_1",
    });

    // AdminAction-row geschreven.
    expect(h.adminActions).toHaveLength(1);
    expect(h.adminActions[0]).toMatchObject({
      adminEmail: "owner@degeldheld.com",
      action: "charge-box3",
      targetType: "Box3Claim",
      targetId: "c_box3_1",
      ok: true,
    });
  });

  it("404 als claim niet bestaat", async () => {
    h.box3Claim = null;
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "missing" }));
    expect(r.status).toBe(404);
    // Audit-log noteert óók niet-gevonden.
    expect(h.adminActions[0]).toMatchObject({ ok: false, errorMessage: expect.stringContaining("not found") });
  });

  it("422 zonder werkelijke-bedrag (claim niet rijp)", async () => {
    h.box3Claim = { userId: "u1", status: "AWAITING_PROOF", werkelijkTeruggaveCents: null };
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(422);
    expect(h.adminActions[0]).toMatchObject({
      ok: false,
      errorMessage: expect.stringContaining("werkelijk"),
    });
  });

  it("409 als claim al CHARGED is", async () => {
    h.box3Claim = { userId: "u1", status: "CHARGED", werkelijkTeruggaveCents: 200_000 };
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(409);
    expect(h.updates).toHaveLength(0); // géén dubbele charge
    expect(h.adminActions[0]).toMatchObject({ ok: false });
  });

  it("Stripe-charge fail → 502 + claim NIET ge-CHARGED + audit-fail gelogd", async () => {
    h.chargeResult = { ok: false, paymentIntentId: "", reason: "card_declined" };
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(502);
    expect(h.updates).toHaveLength(0);
    expect(h.adminActions[0]).toMatchObject({
      ok: false,
      errorMessage: "card_declined",
    });
  });

  it("werkelijk onder Box 3-drempel (€ 250) → fee € 0, claim CHARGED, géén Stripe-call", async () => {
    h.box3Claim = { userId: "u1", status: "PROOF_RECEIVED", werkelijkTeruggaveCents: 25_000 };
    const r = await chargePOST(jsonReq({ type: "Box3Claim", claimId: "c1" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.kind).toBe("no-fee");
    expect(data.feeCents).toBe(0);
    expect(h.updates[0].data).toMatchObject({ status: "CHARGED", feeCents: 0 });
    expect(h.adminActions[0]).toMatchObject({ ok: true });
  });
});

describe("/api/admin/claims/charge — Huur/Energie charge", () => {
  it("HuurServicekostenClaim € 200 → fee € 40 (20%)", async () => {
    h.huurClaim = { userId: "u1", status: "UITSPRAAK", werkelijkeRestitutieCents: 20_000 };
    const r = await chargePOST(jsonReq({ type: "HuurServicekostenClaim", claimId: "c_huur_1" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.feeCents).toBe(4_000);
    expect(h.updates[0].model).toBe("HuurServicekostenClaim");
    expect(h.updates[0].data).toMatchObject({ status: "CHARGED", feeCents: 4_000 });
    expect(h.adminActions[0]).toMatchObject({ action: "charge-huur" });
  });

  it("EnergieEindafrekeningClaim € 5.250 → fee € 1.050 (20%, niet gecapped)", async () => {
    h.energieClaim = { userId: "u1", status: "UITSPRAAK", werkelijkeRestitutieCents: 525_000 };
    const r = await chargePOST(jsonReq({ type: "EnergieEindafrekeningClaim", claimId: "c_e_1" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    // 20% × € 5.250 = € 1.050 boven cap (€ 500) → cap toegepast.
    expect(data.feeCents).toBe(50_000);
    expect(h.updates[0].model).toBe("EnergieEindafrekeningClaim");
    expect(h.adminActions[0]).toMatchObject({ action: "charge-energie" });
  });

  it("HuurServicekostenClaim onder drempel (€ 30) → fee € 0", async () => {
    h.huurClaim = { userId: "u1", status: "UITSPRAAK", werkelijkeRestitutieCents: 3_000 };
    const r = await chargePOST(jsonReq({ type: "HuurServicekostenClaim", claimId: "c_huur_2" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.feeCents).toBe(0);
    expect(data.kind).toBe("no-fee");
  });
});
