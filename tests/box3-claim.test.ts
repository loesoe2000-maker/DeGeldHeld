import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateClaimIntent,
  computeBox3Fee,
  parseBeschikkingAmount,
  decideProofBack,
  processProofUpload,
  BOX3_NCNP_GATE_CENTS,
  BOX3_NCNP_FEE_PCT,
  BOX3_MAX_JAAR,
  type ChargeFn,
} from "@/lib/box3-claim";
import { NO_CURE_NO_PAY_FEE_CAP_CENTS } from "@/lib/payments";

/**
 * v30 DEEL 1 — Box 3 proof-back NCNP-loop.
 *
 * Pure helpers: validateClaimIntent / computeBox3Fee / parseBeschikkingAmount /
 * decideProofBack / processProofUpload. Plus de claim-route (JSON-input).
 *
 * NB: de proof-back route zelf wordt geijkt via processProofUpload (pure,
 * mock-bare charge-fn). jsdom's req.formData() faalt op manuele multipart-
 * bodies — een Playwright-e2e dekt de echte upload-flow.
 */

// ─── Hoisted state voor route-mocks ─────────────────────────────────────────
const h = vi.hoisted(() => ({
  flagOn: true,
  userId: "u1" as string | null,
  userEmail: "anne@x.nl" as string | null,
  claim: null as Record<string, unknown> | null,
  mails: [] as Array<{ to: string; subject: string }>,
}));

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => h.flagOn }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () =>
    h.userId ? { user: { id: h.userId, email: h.userEmail } } : null,
  ),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    box3Claim: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.claim = { id: "claim_1", ...a.data };
        return { id: "claim_1" };
      }),
      findFirst: vi.fn(async () => h.claim),
      update: vi.fn(async () => h.claim ?? {}),
    },
  },
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (o: { to: string; subject: string }) => {
    h.mails.push({ to: o.to, subject: o.subject });
    return { id: "test-mail", skipped: false };
  }),
  escapeHtml: (s: string) => s,
}));

import { POST as claimPOST } from "@/app/api/box3/claim/route";

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.flagOn = true;
  h.userId = "u1";
  h.userEmail = "anne@x.nl";
  h.claim = null;
  h.mails = [];
});

// ─── Pure helpers ──────────────────────────────────────────────────────────

describe("validateClaimIntent (HARDE €500-gate)", () => {
  it("ok bij geldig jaar + bedrag ≥ €500", () => {
    expect(validateClaimIntent({ jaar: 2024, verwachteTeruggaveCents: 50_000 })).toEqual({
      ok: true,
      jaar: 2024,
      verwachteTeruggaveCents: 50_000,
    });
  });

  it("invalid-jaar onder 2017 / boven 2024 / non-integer", () => {
    expect(validateClaimIntent({ jaar: 2016, verwachteTeruggaveCents: 100_000 }).ok).toBe(false);
    expect(validateClaimIntent({ jaar: 2025, verwachteTeruggaveCents: 100_000 }).ok).toBe(false);
    expect(validateClaimIntent({ jaar: "twee", verwachteTeruggaveCents: 100_000 }).ok).toBe(false);
  });

  // v37 — borgt de UI-gate: de Box3-client verbergt de NCNP-knop voor jaren
  // boven BOX3_MAX_JAAR. Deze test koppelt die grens hard aan de API zodat een
  // toekomstige wijziging die de twee uit elkaar laat lopen meteen opvalt.
  it("BOX3_MAX_JAAR is de grens die client + API delen", () => {
    expect(BOX3_MAX_JAAR).toBe(2024);
    // ≤ MAX → ok, > MAX → afgewezen (zelfde regel die de UI gebruikt om de
    // knop te verbergen i.p.v. de gebruiker tegen een 400 te laten lopen).
    expect(validateClaimIntent({ jaar: BOX3_MAX_JAAR, verwachteTeruggaveCents: 100_000 }).ok).toBe(true);
    expect(validateClaimIntent({ jaar: BOX3_MAX_JAAR + 1, verwachteTeruggaveCents: 100_000 }).ok).toBe(false);
  });

  it("invalid-amount bij 0 / negatief / NaN", () => {
    expect(validateClaimIntent({ jaar: 2024, verwachteTeruggaveCents: 0 }).ok).toBe(false);
    expect(validateClaimIntent({ jaar: 2024, verwachteTeruggaveCents: -1 }).ok).toBe(false);
    expect(validateClaimIntent({ jaar: 2024, verwachteTeruggaveCents: "veel" }).ok).toBe(false);
  });

  it("below-ncnp-threshold bij < €500 (NIET stil accepteren)", () => {
    const r = validateClaimIntent({ jaar: 2024, verwachteTeruggaveCents: BOX3_NCNP_GATE_CENTS - 1 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("below-ncnp-threshold");
  });
});

describe("computeBox3Fee", () => {
  it("werkelijk < €500 → fee €0", () => {
    expect(computeBox3Fee(49_999)).toBe(0);
    expect(computeBox3Fee(0)).toBe(0);
    expect(computeBox3Fee(-100)).toBe(0);
  });
  it("werkelijk = €500 → fee 25%", () => {
    expect(computeBox3Fee(50_000)).toBe(Math.round(50_000 * BOX3_NCNP_FEE_PCT));
  });
  it("groot bedrag → gecapt op standaard NCNP-cap", () => {
    expect(computeBox3Fee(1_000_000_00)).toBe(NO_CURE_NO_PAY_FEE_CAP_CENTS);
  });
});

describe("parseBeschikkingAmount — NL-locale + trefwoord-context", () => {
  it("'toegekend bedrag € 1.234,56' → 123456 cent", () => {
    expect(parseBeschikkingAmount("Toegekend bedrag € 1.234,56")?.amountCents).toBe(123_456);
  });
  it("'uit te betalen aan u: EUR 850,00' → 85000 cent", () => {
    expect(parseBeschikkingAmount("Uit te betalen aan u: EUR 850,00")?.amountCents).toBe(85_000);
  });
  it("'vermindering box 3 € 750,00' → 75000 cent", () => {
    expect(parseBeschikkingAmount("Vermindering box 3 € 750,00")?.amountCents).toBe(75_000);
  });
  it("zonder trefwoord → null (geen random bedrag pakken)", () => {
    expect(parseBeschikkingAmount("Datum: 12-03-2025\n€ 9.999,99 op pagina-nummer")).toBeNull();
  });
  it("lege / niet-string → null", () => {
    expect(parseBeschikkingAmount("")).toBeNull();
    expect(parseBeschikkingAmount(null as unknown as string)).toBeNull();
  });
});

describe("decideProofBack", () => {
  it("parsed=null → fail (handmatige review)", () => {
    const r = decideProofBack(null);
    expect(r.kind).toBe("fail");
  });
  it("parsed werkelijk ≥ €500 → charge met juiste fee", () => {
    const r = decideProofBack({ amountCents: 80_000, matchedPhrase: "x" });
    expect(r.kind).toBe("charge");
    if (r.kind === "charge") {
      expect(r.werkelijkTeruggaveCents).toBe(80_000);
      expect(r.feeCents).toBe(Math.round(80_000 * BOX3_NCNP_FEE_PCT));
    }
  });
  it("parsed werkelijk < €500 → no-fee (eerlijke uitkomst)", () => {
    const r = decideProofBack({ amountCents: 30_000, matchedPhrase: "x" });
    expect(r.kind).toBe("no-fee");
  });
});

// ─── processProofUpload (de pure pipeline die de route mechanisch toepast) ──

describe("processProofUpload — end-to-end pipeline", () => {
  const okCharge: ChargeFn = async () => ({ ok: true as const, paymentIntentId: "pi_test_123" });
  const failingCharge: ChargeFn = async () => ({ ok: false as const, reason: "card_declined" });

  it("OCR vindt €800 → 'charged' met fee 25% + chargeFn aangeroepen", async () => {
    const calls: unknown[] = [];
    const charge: ChargeFn = async (o) => {
      calls.push(o);
      return { ok: true, paymentIntentId: "pi_x" };
    };
    const r = await processProofUpload({
      userId: "u1",
      claimId: "c1",
      pdfText: "Toegekend bedrag € 800,00",
      charge,
    });
    expect(r.kind).toBe("charged");
    if (r.kind === "charged") {
      expect(r.werkelijkTeruggaveCents).toBe(80_000);
      expect(r.feeCents).toBe(Math.round(80_000 * BOX3_NCNP_FEE_PCT));
      expect(r.paymentIntentId).toBe("pi_x");
    }
    expect(calls).toHaveLength(1);
  });

  it("OCR vindt €300 → 'no-fee' (eerlijke uitkomst, géén charge-call)", async () => {
    let called = 0;
    const charge: ChargeFn = async () => {
      called++;
      return { ok: true, paymentIntentId: "pi_x" };
    };
    const r = await processProofUpload({
      userId: "u1",
      claimId: "c1",
      pdfText: "Toegekend bedrag € 300,00",
      charge,
    });
    expect(r.kind).toBe("no-fee");
    if (r.kind === "no-fee") expect(r.werkelijkTeruggaveCents).toBe(30_000);
    expect(called).toBe(0);
  });

  it("OCR kan bedrag niet lezen → 'failed' (handmatige review, géén charge)", async () => {
    let called = 0;
    const r = await processProofUpload({
      userId: "u1",
      claimId: "c1",
      pdfText: "Geen relevant bedrag hier",
      charge: async () => {
        called++;
        return { ok: true, paymentIntentId: "pi_x" };
      },
    });
    expect(r.kind).toBe("failed");
    expect(called).toBe(0);
  });

  it("Stripe-charge faalt → 'failed' met reason + werkelijkTeruggaveCents bewaard", async () => {
    const r = await processProofUpload({
      userId: "u1",
      claimId: "c1",
      pdfText: "Toegekend bedrag € 800,00",
      charge: failingCharge,
    });
    expect(r.kind).toBe("failed");
    if (r.kind === "failed") {
      expect(r.reason).toMatch(/card_declined/);
      expect(r.werkelijkTeruggaveCents).toBe(80_000);
    }
  });

  it("lege PDF-tekst → 'failed' (parse-fail)", async () => {
    const r = await processProofUpload({
      userId: "u1",
      claimId: "c1",
      pdfText: "",
      charge: okCharge,
    });
    expect(r.kind).toBe("failed");
  });
});

// ─── /api/box3/claim (JSON-input — werkt zonder formData) ──────────────────

describe("POST /api/box3/claim", () => {
  const url = "https://t/api/box3/claim";

  it("404 disabled wanneer FEATURE_BOX3_CHECK_ENABLED uit", async () => {
    h.flagOn = false;
    const r = await claimPOST(jsonReq(url, { jaar: 2024, verwachteTeruggaveCents: 50_000 }));
    expect(r.status).toBe(404);
  });

  it("401 zonder sessie", async () => {
    h.userId = null;
    const r = await claimPOST(jsonReq(url, { jaar: 2024, verwachteTeruggaveCents: 50_000 }));
    expect(r.status).toBe(401);
  });

  it("422 below-ncnp-threshold bij < €500 (DIY-pad, geen stille acceptatie)", async () => {
    const r = await claimPOST(jsonReq(url, { jaar: 2024, verwachteTeruggaveCents: 49_999 }));
    expect(r.status).toBe(422);
    expect((await r.json()).reason).toBe("below-ncnp-threshold");
    expect(h.claim).toBeNull(); // niets in DB aangemaakt
  });

  it("400 bij invalid jaar", async () => {
    const r = await claimPOST(jsonReq(url, { jaar: 2026, verwachteTeruggaveCents: 50_000 }));
    expect(r.status).toBe(400);
  });

  it("happy path: AWAITING_PROOF + herinneringsmail naar gebruiker", async () => {
    const r = await claimPOST(jsonReq(url, { jaar: 2024, verwachteTeruggaveCents: 60_000 }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.claimId).toBe("claim_1");
    expect(data.status).toBe("AWAITING_PROOF");
    expect((h.claim as { status: string }).status).toBe("AWAITING_PROOF");
    expect(h.mails).toHaveLength(1);
    expect(h.mails[0].to).toBe("anne@x.nl");
  });
});
