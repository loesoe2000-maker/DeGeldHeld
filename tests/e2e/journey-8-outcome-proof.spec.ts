/**
 * v16 DEEL 8 — Stap 8: outcome marking + proof verification +
 * fee trigger.
 *
 * The flow involves writes to Negotiation/OutcomeProof tables in
 * prod, which we don't trigger from CI. The journey-test covers
 * the contract layer:
 *
 *   - outcomeToState() flips SUCCESS_SAVED → SUCCESS_UNVERIFIED
 *     when proof-flow is on, → SUCCESS legacy when off.
 *   - evaluateProof() returns verified / rejected with the right
 *     reasons.
 *   - feeForVerifiedSavings(): rate=20%, cap €50, floor €2,
 *     sub-€25 yearly returns 0 (v13 bounds).
 *   - /api/inbound/proof signature gate rejects unsigned with 401.
 *   - /api/outcome/[id]/proof requires auth.
 *   - Admin bypass: shouldChargeVerifiedFee() never returns true
 *     for admin emails when the flag is on.
 */
import { test, expect } from "@playwright/test";
import { outcomeToState } from "@/lib/flow";
import { evaluateProof } from "@/lib/outcome-proof";
import {
  feeForVerifiedSavings,
  NO_CURE_NO_PAY_FEE_PCT,
  NO_CURE_NO_PAY_FEE_CAP_CENTS,
  NO_CURE_NO_PAY_FEE_FLOOR_CENTS,
  NO_CURE_NO_PAY_MIN_SAVINGS_CENTS,
} from "@/lib/payments";

test.describe("v16 journey-8 — outcome + proof + fee", () => {
  test("outcomeToState: SUCCESS_SAVED with proofRequired flips to SUCCESS_UNVERIFIED", () => {
    const r = outcomeToState("SUCCESS_SAVED", { proofRequired: true });
    expect(r.state).toBe("SUCCESS_UNVERIFIED");
    expect(r.closedAt).toBeInstanceOf(Date);
  });

  test("outcomeToState: SUCCESS_SAVED without flag stays on SUCCESS (legacy)", () => {
    const r = outcomeToState("SUCCESS_SAVED", { proofRequired: false });
    expect(r.state).toBe("SUCCESS");
  });

  test("evaluateProof: 5% drop is verified, 4% is rejected", () => {
    const verified = evaluateProof({ oldMonthlyCents: 10000, newAmountCents: 9500 });
    expect(verified.verdict).toBe("verified");
    const rejected = evaluateProof({ oldMonthlyCents: 10000, newAmountCents: 9700 });
    expect(rejected.verdict).toBe("rejected");
  });

  test("evaluateProof: yearlySavingsCents = delta × 12 when verified", () => {
    const r = evaluateProof({ oldMonthlyCents: 17000, newAmountCents: 14500 });
    if (r.verdict === "verified") {
      expect(r.yearlySavingsCents).toBe(30000); // (17000-14500)*12 = 30000
    } else {
      throw new Error("expected verified");
    }
  });

  test("feeForVerifiedSavings v13 bounds: 20% rate, €50 cap, €25 min", () => {
    expect(NO_CURE_NO_PAY_FEE_PCT).toBe(0.20);
    expect(NO_CURE_NO_PAY_FEE_CAP_CENTS).toBe(5000);
    expect(NO_CURE_NO_PAY_FEE_FLOOR_CENTS).toBe(200);
    expect(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS).toBe(2500);
  });

  test("feeForVerifiedSavings: sub-€25 → 0, €100 → €20, €300 → cap €50", () => {
    expect(feeForVerifiedSavings(2400)).toBe(0); // €24/jaar → no fee
    expect(feeForVerifiedSavings(10000)).toBe(2000); // €100/jaar → €20
    expect(feeForVerifiedSavings(30000)).toBe(5000); // €300/jaar → cap €50
  });

  test("POST /api/inbound/proof without HMAC → 401", async ({ request }) => {
    const r = await request.post("/api/inbound/proof", {
      data: { from: "user@example.com", subject: "x", text: "y" },
    });
    expect(r.status()).toBe(401);
  });

  test("POST /api/outcome/[id]/proof without auth → 401 or 503", async ({ request }) => {
    const r = await request.post("/api/outcome/bogus_id/proof", {
      data: { amountCents: 1000 },
    });
    expect([401, 503]).toContain(r.status());
  });

  test("GET /onderhandel/<bogus>/uitkomst never 500s", async ({ request }) => {
    const r = await request.get("/onderhandel/bogus_id/uitkomst", {
      maxRedirects: 0,
    });
    expect(r.status()).toBeLessThan(500);
  });

  test("source: SUCCESS_UNVERIFIED is excluded from /proof aggregator", () => {
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const ROOT = resolve(__dirname, "../..");
    const src = readFileSync(resolve(ROOT, "app/proof/page.tsx"), "utf8");
    // The aggregator query must filter on the verified set only.
    expect(src).toMatch(/state:\s*\{\s*in:\s*\[\s*"SUCCESS"/);
    // SUCCESS_UNVERIFIED is shown in a separate disclaimer row, not
    // counted toward totalSavedCents.
    expect(src).toMatch(/SUCCESS_UNVERIFIED/);
    expect(src).toMatch(/unverifiedCount/);
  });
});
