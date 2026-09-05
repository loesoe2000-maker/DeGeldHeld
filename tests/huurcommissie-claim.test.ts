/**
 * tests/huurcommissie-claim.test.ts — V35 DEEL 1 — route-tests voor
 * /api/huurcommissie/claim met gemockte Prisma + auth + email.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    huurServicekostenClaim: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.claim = { id: "claim_huur_1", ...a.data };
        return { id: "claim_huur_1" };
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

import { POST as claimPOST } from "@/app/api/huurcommissie/claim/route";

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

describe("/api/huurcommissie/claim — gating", () => {
  it("404 als HUURCOMMISSIE_CHECK_ENABLED uit staat", async () => {
    h.flagOn = false;
    const r = await claimPOST(jsonReq("http://x/api/huurcommissie/claim", {}));
    expect(r.status).toBe(404);
  });

  it("401 zonder sessie", async () => {
    h.userId = null;
    const r = await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2024,
        verwachteRestitutieCents: 10_000,
      }),
    );
    expect(r.status).toBe(401);
  });
});

describe("/api/huurcommissie/claim — validatie", () => {
  it("v41 GRATIS: onder € 50 wordt de claim gewoon aangemaakt", async () => {
    // De € 50-drempel bestond om te bepalen of een fee loonde.
    // Zonder fee weigeren we niemand meer.
    const r = await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2024,
        verwachteRestitutieCents: 4_999, // onder de oude € 50-drempel
      }),
    );
    expect(r.status).toBe(200);
  });

  it("400 bij invalid-boekjaar", async () => {
    const r = await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2019, // onder min
        verwachteRestitutieCents: 10_000,
      }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.reason).toBe("invalid-boekjaar");
  });

  it("400 bij invalid-amount", async () => {
    const r = await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2024,
        verwachteRestitutieCents: -100,
      }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.reason).toBe("invalid-amount");
  });

  it("400 bij ontbrekende body", async () => {
    const r = await claimPOST(
      new Request("http://x/api/huurcommissie/claim", { method: "POST" }),
    );
    expect(r.status).toBe(400);
  });
});

describe("/api/huurcommissie/claim — happy-path", () => {
  it("≥ € 50 → 200 + status INTENT + Prisma create met sourced velden", async () => {
    const r = await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2024,
        verwachteRestitutieCents: 15_000,
        verhuurderNaam: "Vesteda",
      }),
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("INTENT");
    expect(body.claimId).toBe("claim_huur_1");

    // Claim correct opgeslagen (gemockte Prisma).
    expect(h.claim).toMatchObject({
      userId: "u1",
      boekjaar: 2024,
      verhuurderNaam: "Vesteda",
      verwachteRestitutieCents: 15_000,
      status: "INTENT",
    });
  });

  it("herinnerings-mail verstuurd naar de user", async () => {
    await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2024,
        verwachteRestitutieCents: 20_000,
      }),
    );
    expect(h.mails).toHaveLength(1);
    expect(h.mails[0].to).toBe("anne@x.nl");
    expect(h.mails[0].subject).toMatch(/Huurcommissie/i);
  });

  it("user zonder e-mail → géén crash + claim aangemaakt", async () => {
    h.userEmail = null;
    const r = await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2024,
        verwachteRestitutieCents: 20_000,
      }),
    );
    expect(r.status).toBe(200);
    expect(h.mails).toHaveLength(0);
  });

  it("verhuurderNaam=null → claim aangemaakt zonder naam", async () => {
    await claimPOST(
      jsonReq("http://x/api/huurcommissie/claim", {
        boekjaar: 2024,
        verwachteRestitutieCents: 20_000,
        verhuurderNaam: null,
      }),
    );
    expect(h.claim).toMatchObject({ verhuurderNaam: null });
  });
});
