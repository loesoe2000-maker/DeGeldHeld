/**
 * tests/energie-claim-route.test.ts — V35 DEEL 2 — route-tests voor
 * /api/energie-claim/claim met gemockte Prisma + auth + email.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    energieEindafrekeningClaim: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.claim = { id: "claim_energie_1", ...a.data };
        return { id: "claim_energie_1" };
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

import { POST as claimPOST } from "@/app/api/energie-claim/claim/route";

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

describe("/api/energie-claim/claim — gating", () => {
  it("404 als ENERGIE_CLAIM_CHECK_ENABLED uit staat", async () => {
    h.flagOn = false;
    const r = await claimPOST(jsonReq("http://x/api/energie-claim/claim", {}));
    expect(r.status).toBe(404);
  });

  it("401 zonder sessie", async () => {
    h.userId = null;
    const r = await claimPOST(
      jsonReq("http://x/api/energie-claim/claim", {
        provider: "Vattenfall",
        verwachteRestitutieCents: 10_000,
      }),
    );
    expect(r.status).toBe(401);
  });
});

describe("/api/energie-claim/claim — validatie", () => {
  it("v41 GRATIS: onder € 50 wordt de claim gewoon aangemaakt", async () => {
    // De € 50-drempel bestond om te bepalen of een fee loonde.
    // Zonder fee weigeren we niemand meer.
    const r = await claimPOST(
      jsonReq("http://x/api/energie-claim/claim", {
        provider: "Eneco",
        verwachteRestitutieCents: 4_999, // onder de oude € 50-drempel
      }),
    );
    expect(r.status).toBe(200);
  });

  it("400 bij lege provider", async () => {
    const r = await claimPOST(
      jsonReq("http://x/api/energie-claim/claim", {
        provider: "",
        verwachteRestitutieCents: 10_000,
      }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.reason).toBe("invalid-provider");
  });

  it("400 bij invalid-amount", async () => {
    const r = await claimPOST(
      jsonReq("http://x/api/energie-claim/claim", {
        provider: "Eneco",
        verwachteRestitutieCents: -100,
      }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.reason).toBe("invalid-amount");
  });
});

describe("/api/energie-claim/claim — happy-path", () => {
  it("≥ € 50 → 200 + INTENT + Prisma create met sourced velden", async () => {
    const r = await claimPOST(
      jsonReq("http://x/api/energie-claim/claim", {
        provider: "Vattenfall",
        verwachteRestitutieCents: 15_000,
      }),
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("INTENT");
    expect(body.claimId).toBe("claim_energie_1");

    expect(h.claim).toMatchObject({
      userId: "u1",
      provider: "Vattenfall",
      verwachteRestitutieCents: 15_000,
      status: "INTENT",
    });
  });

  it("herinnerings-mail verstuurd met provider in subject", async () => {
    await claimPOST(
      jsonReq("http://x/api/energie-claim/claim", {
        provider: "Greenchoice",
        verwachteRestitutieCents: 20_000,
      }),
    );
    expect(h.mails).toHaveLength(1);
    expect(h.mails[0].to).toBe("anne@x.nl");
    expect(h.mails[0].subject).toMatch(/Energie/i);
  });

  it("user zonder e-mail → géén crash + claim aangemaakt", async () => {
    h.userEmail = null;
    const r = await claimPOST(
      jsonReq("http://x/api/energie-claim/claim", {
        provider: "Vattenfall",
        verwachteRestitutieCents: 20_000,
      }),
    );
    expect(r.status).toBe(200);
    expect(h.mails).toHaveLength(0);
  });
});
