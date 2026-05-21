import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * v23 DEEL 6 — provider pushback + loop guard + idempotency + anti-abuse,
 * consolidated. The decision logic is unit-tested in relay-core/relay-inbound;
 * here we cover the pause endpoint (revocability) + source-level invariants.
 */

const h = vi.hoisted(() => ({
  userId: "u1" as string | null,
  neg: { id: "neg_1", relayAuthorizedAt: new Date() } as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (h.userId ? { user: { id: h.userId } } : null)) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findFirst: vi.fn(async () => h.neg),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => { h.updates.push(a.data); return {}; }),
    },
  },
}));

import { POST as pausePOST } from "@/app/api/negotiations/[id]/relay-pause/route";

function req(action: unknown) {
  return new Request("https://t/api/negotiations/neg_1/relay-pause", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
const ctx = { params: Promise.resolve({ id: "neg_1" }) };

beforeEach(() => {
  h.userId = "u1";
  h.neg = { id: "neg_1", relayAuthorizedAt: new Date() };
  h.updates = [];
});

describe("v23 relay-pause — revocability (art. 3:72 BW)", () => {
  it("401 unauthenticated", async () => {
    h.userId = null;
    expect((await pausePOST(req("pause"), ctx)).status).toBe(401);
  });
  it("400 invalid action", async () => {
    expect((await pausePOST(req("bogus"), ctx)).status).toBe(400);
  });
  it("409 when no relay was authorized", async () => {
    h.neg = { id: "neg_1", relayAuthorizedAt: null };
    expect((await pausePOST(req("pause"), ctx)).status).toBe(409);
  });
  it("pause → PAUSED, resume → RELAY_ACTIVE", async () => {
    await pausePOST(req("pause"), ctx);
    expect(h.updates.at(-1)?.relayState).toBe("PAUSED");
    await pausePOST(req("resume"), ctx);
    expect(h.updates.at(-1)?.relayState).toBe("RELAY_ACTIVE");
  });
});

describe("v23 anti-abuse — source-level invariants", () => {
  const root = resolve(__dirname, "..");
  const read = (p: string) => readFileSync(resolve(root, p), "utf8");

  it("relay-authorize is owner-scoped (findFirst with userId)", () => {
    const src = read("app/api/negotiations/[id]/relay-authorize/route.ts");
    expect(src).toMatch(/findFirst\(\{\s*where:\s*\{\s*id,\s*userId\s*\}/);
  });
  it("relay-approve + relay-pause are owner-scoped", () => {
    for (const p of [
      "app/api/negotiations/[id]/relay-approve/route.ts",
      "app/api/negotiations/[id]/relay-pause/route.ts",
    ]) {
      expect(read(p)).toMatch(/where:\s*\{\s*id,\s*userId\s*\}/);
    }
  });
  it("inbound relay routes ONLY by the unique relay token (token-scoped)", () => {
    const src = read("lib/relay-inbound.ts");
    expect(src).toMatch(/findUnique\(\{\s*where:\s*\{\s*relayToken:/);
  });
  it("relay token is crypto-random (not Math.random)", () => {
    const src = read("lib/relay.ts");
    expect(src).toMatch(/crypto\.randomBytes/);
    expect(src).not.toMatch(/Math\.random/);
  });
  it("every outbound relay send is consent-gated by canRelaySend", () => {
    const src = read("lib/relay-send.ts");
    expect(src).toMatch(/canRelaySend\(neg\)/);
  });
});
