import { describe, it, expect } from "vitest";
import {
  mapBox3Claim,
  mapHuurClaim,
  mapEnergieClaim,
  getUserClaims,
  computeStats,
  type Box3ClaimRow,
  type HuurClaimRow,
  type EnergieClaimRow,
} from "@/lib/claim-dashboard";

/**
 * v36 idee 1 — claim-dashboard pure mappers + aggregator.
 *
 * Wat we testen:
 *  - Status-mapping per claim-type (NL-label + next-step)
 *  - Closed-detectie (CHARGED + FAILED)
 *  - Unknown-status fallback (no crash)
 *  - Aggregator: sortering (open eerst, daarna closed; nieuwste eerst)
 *  - computeStats: telt expected alleen voor open, recovered voor alles
 *    met werkelijk-bedrag, fee alleen voor CHARGED
 */

const B = (over: Partial<Box3ClaimRow> = {}): Box3ClaimRow => ({
  id: "b1",
  jaar: 2023,
  verwachteTeruggaveCents: 80_000,
  werkelijkTeruggaveCents: null,
  status: "INTENT",
  proofStorageUrl: null,
  proofUploadedAt: null,
  chargedAt: null,
  feeCents: null,
  createdAt: new Date("2026-01-15T10:00:00Z"),
  ...over,
});

const H = (over: Partial<HuurClaimRow> = {}): HuurClaimRow => ({
  id: "h1",
  boekjaar: 2024,
  verhuurderNaam: null,
  verwachteRestitutieCents: 12_000,
  werkelijkeRestitutieCents: null,
  status: "INTENT",
  uitspraakStorageUrl: null,
  uitspraakUploadedAt: null,
  chargedAt: null,
  feeCents: null,
  createdAt: new Date("2026-02-01T10:00:00Z"),
  ...over,
});

const E = (over: Partial<EnergieClaimRow> = {}): EnergieClaimRow => ({
  id: "e1",
  provider: "Vattenfall",
  verwachteRestitutieCents: 9_500,
  werkelijkeRestitutieCents: null,
  status: "INTENT",
  uitspraakStorageUrl: null,
  uitspraakUploadedAt: null,
  chargedAt: null,
  feeCents: null,
  createdAt: new Date("2026-03-10T10:00:00Z"),
  ...over,
});

describe("mapBox3Claim", () => {
  it("INTENT → open + NL-label + concrete next-step", () => {
    const m = mapBox3Claim(B());
    expect(m.type).toBe("Box3Claim");
    expect(m.titel).toMatch(/Box 3/);
    expect(m.titel).toMatch(/2023/);
    expect(m.statusCode).toBe("INTENT");
    expect(m.statusLabel).toMatch(/Bezwaar klaar/);
    expect(m.nextStep).toMatch(/Belastingdienst/);
    expect(m.closed).toBe(false);
  });

  it("AWAITING_PROOF → wachten op beschikking", () => {
    const m = mapBox3Claim(B({ status: "AWAITING_PROOF" }));
    expect(m.statusLabel).toMatch(/ingediend/i);
    expect(m.nextStep).toMatch(/beschikking/i);
    expect(m.closed).toBe(false);
  });

  it("CHARGED → closed + 'verrekend'-text", () => {
    const m = mapBox3Claim(
      B({
        status: "CHARGED",
        werkelijkTeruggaveCents: 120_000,
        chargedAt: new Date("2026-05-01"),
        feeCents: 30_000,
        proofStorageUrl: "https://blob/x.pdf",
      }),
    );
    expect(m.closed).toBe(true);
    expect(m.statusLabel).toMatch(/Afgerond/);
    expect(m.werkelijkeRestitutieCents).toBe(120_000);
    expect(m.feeCents).toBe(30_000);
    expect(m.hasUploadedDoc).toBe(true);
  });

  it("FAILED → closed maar GEEN fee (no cure no pay)", () => {
    const m = mapBox3Claim(B({ status: "FAILED" }));
    expect(m.closed).toBe(true);
    expect(m.nextStep).toMatch(/no cure, no pay|geen fee/i);
  });

  it("unknown status → fallback zonder crash", () => {
    const m = mapBox3Claim(B({ status: "WHATEVER" }));
    expect(m.statusLabel).toBe("WHATEVER");
    expect(m.nextStep).toMatch(/onbekend|contact/i);
  });
});

describe("mapHuurClaim", () => {
  it("INTENT → verstuur naar verhuurder", () => {
    const m = mapHuurClaim(H());
    expect(m.type).toBe("HuurServicekostenClaim");
    expect(m.titel).toMatch(/Huurcommissie/i);
    expect(m.titel).toMatch(/2024/);
    expect(m.nextStep).toMatch(/verhuurder/);
  });

  it("met verhuurdernaam → naam in titel", () => {
    const m = mapHuurClaim(H({ verhuurderNaam: "Vesteda" }));
    expect(m.titel).toMatch(/Vesteda/);
  });

  it("BEZWAAR_GESTUURD → noemt de 21-dagen termijn", () => {
    const m = mapHuurClaim(H({ status: "BEZWAAR_GESTUURD" }));
    expect(m.nextStep).toMatch(/21 dagen/);
    expect(m.closed).toBe(false);
  });

  it("HUURCOMMISSIE_INGEDIEND → 5 maanden", () => {
    const m = mapHuurClaim(H({ status: "HUURCOMMISSIE_INGEDIEND" }));
    expect(m.nextStep).toMatch(/5 maanden/);
  });

  it("UITSPRAAK → 20% NCNP genoemd", () => {
    const m = mapHuurClaim(H({ status: "UITSPRAAK" }));
    expect(m.nextStep).toMatch(/20%/);
    expect(m.nextStep).toMatch(/NCNP/);
  });

  it("hasUploadedDoc reflects uitspraakStorageUrl", () => {
    expect(mapHuurClaim(H({ uitspraakStorageUrl: null })).hasUploadedDoc).toBe(false);
    expect(
      mapHuurClaim(H({ uitspraakStorageUrl: "https://blob/u.pdf" })).hasUploadedDoc,
    ).toBe(true);
  });
});

describe("mapEnergieClaim", () => {
  it("INTENT → verstuur naar energieleverancier", () => {
    const m = mapEnergieClaim(E());
    expect(m.type).toBe("EnergieEindafrekeningClaim");
    expect(m.titel).toMatch(/Energie/);
    expect(m.titel).toMatch(/Vattenfall/);
    expect(m.nextStep).toMatch(/energieleverancier/);
  });

  it("KLACHT_GESTUURD → 30 dagen termijn", () => {
    const m = mapEnergieClaim(E({ status: "KLACHT_GESTUURD" }));
    expect(m.nextStep).toMatch(/30 dagen/);
  });

  it("GESCHILLENCOMMISSIE_INGEDIEND → 3 maanden", () => {
    const m = mapEnergieClaim(E({ status: "GESCHILLENCOMMISSIE_INGEDIEND" }));
    expect(m.nextStep).toMatch(/3 maanden/);
  });
});

describe("getUserClaims — aggregator", () => {
  function fakeDb(
    box3: Box3ClaimRow[],
    huur: HuurClaimRow[],
    energie: EnergieClaimRow[],
    volmachten: Array<{
      claimType: string;
      claimId: string;
      signedAt: Date;
      revokedAt: Date | null;
    }> = [],
  ) {
    return {
      box3Claim: { findMany: async () => box3 },
      huurServicekostenClaim: { findMany: async () => huur },
      energieEindafrekeningClaim: { findMany: async () => energie },
      volmacht: { findMany: async () => volmachten },
    };
  }

  it("lege DB → lege array", async () => {
    const r = await getUserClaims("u1", fakeDb([], [], []));
    expect(r).toEqual([]);
  });

  it("merge over 3 modellen", async () => {
    const r = await getUserClaims(
      "u1",
      fakeDb([B()], [H()], [E()]),
    );
    expect(r).toHaveLength(3);
    expect(new Set(r.map((c) => c.type))).toEqual(
      new Set(["Box3Claim", "HuurServicekostenClaim", "EnergieEindafrekeningClaim"]),
    );
  });

  it("open komt vóór closed", async () => {
    const r = await getUserClaims(
      "u1",
      fakeDb(
        [
          B({ id: "old-closed", status: "CHARGED", createdAt: new Date("2026-04-01") }),
          B({ id: "fresh-open", status: "INTENT", createdAt: new Date("2026-01-01") }),
        ],
        [],
        [],
      ),
    );
    // fresh-open is ouder maar moet eerst staan (open vóór closed).
    expect(r[0]?.id).toBe("fresh-open");
    expect(r[1]?.id).toBe("old-closed");
  });

  it("binnen open-groep: nieuwste eerst", async () => {
    const r = await getUserClaims(
      "u1",
      fakeDb(
        [
          B({ id: "oud", status: "INTENT", createdAt: new Date("2026-01-01") }),
          B({ id: "nieuw", status: "INTENT", createdAt: new Date("2026-04-01") }),
        ],
        [],
        [],
      ),
    );
    expect(r[0]?.id).toBe("nieuw");
    expect(r[1]?.id).toBe("oud");
  });

  it("v36 idee 2 — volmacht-status komt mee in dashboard-claim", async () => {
    const r = await getUserClaims(
      "u1",
      fakeDb(
        [],
        [H({ id: "huur1", status: "BEZWAAR_GESTUURD" })],
        [E({ id: "energie1", status: "KLACHT_GESTUURD" })],
        [
          {
            claimType: "HuurServicekostenClaim",
            claimId: "huur1",
            signedAt: new Date("2026-04-10"),
            revokedAt: null,
          },
        ],
      ),
    );
    const huur = r.find((c) => c.id === "huur1");
    const energie = r.find((c) => c.id === "energie1");
    expect(huur?.hasVolmacht).toBe(true);
    expect(huur?.volmachtSignedAt?.toISOString()).toMatch(/^2026-04-10/);
    expect(energie?.hasVolmacht).toBe(false);
    expect(energie?.supportsVolmacht).toBe(true);
  });

  it("v36 idee 2 — Box 3 ondersteunt geen SES-volmacht", async () => {
    const r = await getUserClaims(
      "u1",
      fakeDb([B({ id: "b1", status: "INTENT" })], [], []),
    );
    const b = r.find((c) => c.id === "b1");
    expect(b?.supportsVolmacht).toBe(false);
    expect(b?.hasVolmacht).toBe(false);
  });

  it("v36 idee 2 — gerevoceerde volmacht telt niet als active", async () => {
    const r = await getUserClaims(
      "u1",
      fakeDb(
        [],
        [H({ id: "huur1", status: "INTENT" })],
        [],
        [
          {
            claimType: "HuurServicekostenClaim",
            claimId: "huur1",
            signedAt: new Date("2026-03-01"),
            revokedAt: new Date("2026-04-01"),
          },
        ],
      ),
    );
    expect(r[0]?.hasVolmacht).toBe(false);
  });
});

describe("computeStats", () => {
  it("lege lijst → alles 0", () => {
    const s = computeStats([]);
    expect(s).toEqual({
      totalCount: 0,
      openCount: 0,
      closedCount: 0,
      totalExpectedCents: 0,
      totalRecoveredCents: 0,
      totalFeeChargedCents: 0,
    });
  });

  it("expected telt alleen voor open claims", () => {
    const s = computeStats([
      mapBox3Claim(B({ status: "INTENT", verwachteTeruggaveCents: 50_000 })),
      mapBox3Claim(
        B({
          status: "CHARGED",
          verwachteTeruggaveCents: 99_999,
          werkelijkTeruggaveCents: 80_000,
          feeCents: 20_000,
        }),
      ),
    ]);
    // CHARGED is closed → niet meetellen in expected.
    expect(s.totalExpectedCents).toBe(50_000);
    expect(s.totalRecoveredCents).toBe(80_000);
    expect(s.totalFeeChargedCents).toBe(20_000);
    expect(s.openCount).toBe(1);
    expect(s.closedCount).toBe(1);
  });

  it("fee telt alleen bij status=CHARGED (niet bij FAILED)", () => {
    const s = computeStats([
      mapBox3Claim(B({ status: "FAILED", feeCents: 0 })),
      mapBox3Claim(B({ status: "CHARGED", feeCents: 10_000, werkelijkTeruggaveCents: 40_000 })),
    ]);
    expect(s.totalFeeChargedCents).toBe(10_000);
  });
});
