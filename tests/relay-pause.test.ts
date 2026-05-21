import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v25 DEEL 0/4 — relay-pause entrypoint: flag-gated, owner-only, and the
 * always-available revoke control (pause → no automatic mails go out).
 */
const h = vi.hoisted(() => ({
  flagOn: true,
  userId: "u1" as string | null,
  neg: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => h.flagOn }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (h.userId ? { user: { id: h.userId } } : null)) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findFirst: vi.fn(async () => h.neg),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => { h.updates.push(a.data); return {}; }),
    },
  },
}));

import { POST } from "@/app/api/negotiations/[id]/relay-pause/route";

function req(action: unknown) {
  return new Request("https://t/api/negotiations/neg_1/relay-pause", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
const ctx = { params: Promise.resolve({ id: "neg_1" }) };

beforeEach(() => {
  h.flagOn = true;
  h.userId = "u1";
  h.neg = { id: "neg_1", relayAuthorizedAt: new Date() };
  h.updates = [];
});

describe("v25 relay-pause gate", () => {
  it("404 disabled when the flag is off", async () => {
    h.flagOn = false;
    expect((await POST(req("pause"), ctx)).status).toBe(404);
    expect(h.updates).toHaveLength(0);
  });

  it("401 when unauthenticated", async () => {
    h.userId = null;
    expect((await POST(req("pause"), ctx)).status).toBe(401);
  });

  it("400 on an invalid action", async () => {
    expect((await POST(req("nope"), ctx)).status).toBe(400);
  });

  it("409 when no relay was ever authorized", async () => {
    h.neg = { id: "neg_1", relayAuthorizedAt: null };
    expect((await POST(req("pause"), ctx)).status).toBe(409);
  });

  it("pause → PAUSED", async () => {
    const res = await POST(req("pause"), ctx);
    expect(res.status).toBe(200);
    expect(h.updates[0].relayState).toBe("PAUSED");
  });

  it("resume → RELAY_ACTIVE", async () => {
    const res = await POST(req("resume"), ctx);
    expect(res.status).toBe(200);
    expect(h.updates[0].relayState).toBe("RELAY_ACTIVE");
  });
});
