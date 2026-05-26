/**
 * tests/gdpr-cycle.test.ts — V36 DEEL 2.
 *
 * End-to-end GDPR cycle voor de V29-V35-modellen:
 *   1. /api/account/export bevat alle nieuwe modellen
 *      (Box3Claim, HuurServicekostenClaim, EnergieEindafrekeningClaim, PlusRescan)
 *   2. /api/account/delete scrubt vrije-tekst + storage-URLs, behoudt
 *      financial-record-velden (chargedAt, feeCents, stripePaymentIntentId)
 *
 * Mock-pattern identiek aan tests/account-deletion.test.ts: gemockte
 * Prisma capture per model wat er werd gelezen/geschreven.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  userId: "u_gdpr" as string | null,
  email: "anne@x.nl" as string | null,
  box3: [] as Record<string, unknown>[],
  huur: [] as Record<string, unknown>[],
  energie: [] as Record<string, unknown>[],
  plusRescans: [] as Record<string, unknown>[],
  updates: [] as Array<{ model: string; where: unknown; data: Record<string, unknown> }>,
  deletes: [] as Array<{ model: string; where: unknown }>,
  txCalls: [] as unknown[],
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () =>
    h.userId ? { user: { id: h.userId, email: h.email } } : null,
  ),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true })),
  rateLimitResponse: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const noop = vi.fn(async () => []);
  const noopOne = vi.fn(async () => null);
  const captureUpdate = (model: string) =>
    vi.fn(async (a: { where: unknown; data: Record<string, unknown> }) => {
      h.updates.push({ model, where: a.where, data: a.data });
      return { count: 1 };
    });
  const captureDelete = (model: string) =>
    vi.fn(async (a: { where: unknown }) => {
      h.deletes.push({ model, where: a.where });
      return { count: 1 };
    });
  return {
    prisma: {
      // Read-side voor export.
      user: {
        findUnique: vi.fn(async () => ({
          id: h.userId,
          email: h.email,
          name: "Anne",
          createdAt: new Date("2026-01-01"),
          notificationsEnabled: true,
          ocrTrainingOptIn: false,
          referralCode: null,
        })),
        update: vi.fn(async (a: { where: unknown; data: Record<string, unknown> }) => {
          h.updates.push({ model: "User", where: a.where, data: a.data });
          return { id: h.userId };
        }),
      },
      bill: {
        findMany: noop,
        updateMany: captureUpdate("Bill"),
      },
      negotiation: { findMany: noop, updateMany: captureUpdate("Negotiation") },
      payment: { findMany: noop },
      waitlistEntry: {
        findMany: noop,
        deleteMany: captureDelete("WaitlistEntry"),
      },
      referral: { findMany: noop },
      session: {
        findMany: noop,
        deleteMany: captureDelete("Session"),
      },
      account: { deleteMany: captureDelete("Account") },
      box3Claim: {
        findMany: vi.fn(async () => h.box3),
        updateMany: captureUpdate("Box3Claim"),
      },
      huurServicekostenClaim: {
        findMany: vi.fn(async () => h.huur),
        updateMany: captureUpdate("HuurServicekostenClaim"),
      },
      energieEindafrekeningClaim: {
        findMany: vi.fn(async () => h.energie),
        updateMany: captureUpdate("EnergieEindafrekeningClaim"),
      },
      plusRescan: {
        findMany: vi.fn(async () => h.plusRescans),
        deleteMany: captureDelete("PlusRescan"),
      },
      negotiationRound: { updateMany: captureUpdate("NegotiationRound") },
      outcomeProof: { updateMany: captureUpdate("OutcomeProof") },
      whatsAppThread: { updateMany: captureUpdate("WhatsAppThread") },
      whatsAppMessage: { updateMany: captureUpdate("WhatsAppMessage") },
      fraudFlag: { updateMany: captureUpdate("FraudFlag") },
      ocrTrainingSample: { updateMany: captureUpdate("OcrTrainingSample") },
      $transaction: vi.fn(async (ops: Promise<unknown>[]) => {
        // Pass-through — alle ops zijn al captured via de individuele
        // updateMany/deleteMany mocks.
        h.txCalls.push(ops);
        return Promise.all(ops);
      }),
      // Catch-alls voor andere prisma-models die delete-route raakt.
      ocrTrainingSample_alt: noopOne,
    },
  };
});

import { GET as exportGET } from "@/app/api/account/export/route";
import { POST as deletePOST } from "@/app/api/account/delete/route";

beforeEach(() => {
  h.userId = "u_gdpr";
  h.email = "anne@x.nl";
  h.box3 = [
    {
      id: "b3_1",
      jaar: 2024,
      verwachteTeruggaveCents: 200_000,
      status: "CHARGED",
      werkelijkTeruggaveCents: 150_000,
      proofStorageUrl: "https://blob.example/b3_1.pdf",
      proofUploadedAt: new Date("2026-04-01"),
      chargedAt: new Date("2026-04-05"),
      feeCents: 37_500,
      stripePaymentIntentId: "pi_b3_1",
      failureReason: null,
      createdAt: new Date("2026-03-01"),
      updatedAt: new Date("2026-04-05"),
    },
  ];
  h.huur = [
    {
      id: "h_1",
      boekjaar: 2024,
      verhuurderNaam: "Vesteda",
      verwachteRestitutieCents: 20_000,
      status: "UITSPRAAK",
      werkelijkeRestitutieCents: 15_000,
      uitspraakStorageUrl: "https://blob.example/h_1.pdf",
      uitspraakUploadedAt: new Date("2026-04-10"),
      chargedAt: null,
      feeCents: null,
      stripePaymentIntentId: null,
      failureReason: null,
      createdAt: new Date("2026-02-01"),
      updatedAt: new Date("2026-04-10"),
    },
  ];
  h.energie = [
    {
      id: "e_1",
      provider: "Vattenfall",
      verwachteRestitutieCents: 8_000,
      status: "CHARGED",
      werkelijkeRestitutieCents: 7_500,
      uitspraakStorageUrl: "https://blob.example/e_1.pdf",
      uitspraakUploadedAt: new Date("2026-04-12"),
      chargedAt: new Date("2026-04-15"),
      feeCents: 1_500,
      stripePaymentIntentId: "pi_e_1",
      failureReason: null,
      createdAt: new Date("2026-03-01"),
      updatedAt: new Date("2026-04-15"),
    },
  ];
  h.plusRescans = [
    {
      id: "pr_1",
      runAt: new Date("2026-04-01"),
      findingsJson: { snapshot: [], delta: {} },
      notifiedAt: null,
    },
  ];
  h.updates = [];
  h.deletes = [];
  h.txCalls = [];
});

// ─── EXPORT (Art. 20 portability) ──────────────────────────────────────────

describe("/api/account/export — V29-V35 modellen worden meegenomen", () => {
  it("export bevat alle 4 nieuwe top-level keys", async () => {
    const r = await exportGET();
    expect(r.status).toBe(200);
    const body = JSON.parse(await r.text());
    expect(Object.keys(body)).toEqual(
      expect.arrayContaining([
        "user",
        "bills",
        "negotiations",
        "payments",
        "box3Claims",
        "huurServicekostenClaims",
        "energieEindafrekeningClaims",
        "plusRescans",
      ]),
    );
  });

  it("élke Box3Claim/HuurClaim/EnergieClaim is volledig in export", async () => {
    const r = await exportGET();
    const body = JSON.parse(await r.text());
    expect(body.box3Claims).toHaveLength(1);
    expect(body.box3Claims[0].id).toBe("b3_1");
    expect(body.box3Claims[0].stripePaymentIntentId).toBe("pi_b3_1");
    expect(body.huurServicekostenClaims[0].verhuurderNaam).toBe("Vesteda");
    expect(body.energieEindafrekeningClaims[0].provider).toBe("Vattenfall");
    expect(body.plusRescans).toHaveLength(1);
  });

  it("Content-Disposition header voor download-prompt aanwezig", async () => {
    const r = await exportGET();
    expect(r.headers.get("content-disposition")).toMatch(/attachment.*dgh-export-/);
  });

  it("401 zonder sessie", async () => {
    h.userId = null;
    const r = await exportGET();
    expect(r.status).toBe(401);
  });
});

// ─── DELETE (Art. 17 anonimisering) ────────────────────────────────────────

function findUpdate(model: string): Record<string, unknown> | null {
  return h.updates.find((u) => u.model === model)?.data ?? null;
}

describe("/api/account/delete — V29-V35 claims worden gescrubd", () => {
  function deleteReq() {
    return new Request("http://x/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "VERWIJDER MIJN ACCOUNT" }),
    });
  }

  it("Box3Claim: proofStorageUrl + failureReason gescrubd, financial-record-velden behouden", async () => {
    const r = await deletePOST(deleteReq());
    expect(r.status).toBe(200);
    const update = findUpdate("Box3Claim");
    expect(update).not.toBeNull();
    // Free-text + storage URL → null
    expect(update).toMatchObject({
      proofStorageUrl: null,
      failureReason: null,
    });
    // Géén poging om feeCents / chargedAt / stripePaymentIntentId te scrubben
    // (financiële records moeten blijven voor bewaarplicht).
    expect((update as Record<string, unknown>).feeCents).toBeUndefined();
    expect((update as Record<string, unknown>).chargedAt).toBeUndefined();
    expect((update as Record<string, unknown>).stripePaymentIntentId).toBeUndefined();
  });

  it("HuurServicekostenClaim: verhuurderNaam + uitspraakStorageUrl gescrubd", async () => {
    await deletePOST(deleteReq());
    const update = findUpdate("HuurServicekostenClaim");
    expect(update).toMatchObject({
      verhuurderNaam: null,
      uitspraakStorageUrl: null,
      failureReason: null,
    });
  });

  it("EnergieEindafrekeningClaim: provider → '[verwijderd]' (NOT NULL veld) + storage-URL null", async () => {
    await deletePOST(deleteReq());
    const update = findUpdate("EnergieEindafrekeningClaim");
    expect(update).toMatchObject({
      provider: "[verwijderd]",
      uitspraakStorageUrl: null,
      failureReason: null,
    });
  });

  it("PlusRescan: hard-delete (findingsJson kan provider-namen bevatten)", async () => {
    await deletePOST(deleteReq());
    const del = h.deletes.find((d) => d.model === "PlusRescan");
    expect(del).toBeDefined();
    expect(del?.where).toMatchObject({ userId: "u_gdpr" });
  });

  it("User-update: email → placeholder, deletedAt geset, stripe ids leeg", async () => {
    await deletePOST(deleteReq());
    const update = findUpdate("User");
    expect(update).toMatchObject({
      name: null,
      image: null,
      emailVerified: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
    expect((update as { email?: string }).email).toMatch(/deleted-/);
    expect((update as { deletedAt?: Date }).deletedAt).toBeInstanceOf(Date);
  });

  it("400 zonder confirm-string", async () => {
    const r = await deletePOST(
      new Request("http://x/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "nope" }),
      }),
    );
    expect(r.status).toBe(400);
    // Geen scrubs uitgevoerd.
    expect(h.updates).toHaveLength(0);
    expect(h.deletes).toHaveLength(0);
  });
});
