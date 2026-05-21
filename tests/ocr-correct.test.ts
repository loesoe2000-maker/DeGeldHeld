import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v24 DEEL 2 — OCR inline correction route. Owner-only; supported categories
 * only; validates input; writes the correction to the Bill.
 */
const h = vi.hoisted(() => ({
  userId: "u1" as string | null,
  bill: { id: "bill_1" } as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (h.userId ? { user: { id: h.userId } } : null)) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    bill: {
      findFirst: vi.fn(async () => h.bill),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => { h.updates.push(a.data); return {}; }),
    },
  },
}));

import { POST } from "@/app/api/bills/[id]/correct/route";

function req(body: unknown) {
  return new Request("https://t/api/bills/bill_1/correct", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "bill_1" }) };

beforeEach(() => {
  h.userId = "u1";
  h.bill = { id: "bill_1" };
  h.updates = [];
});

describe("v24 OCR correction route", () => {
  it("401 unauthenticated", async () => {
    h.userId = null;
    expect((await POST(req({ provider: "KPN" }), ctx)).status).toBe(401);
  });

  it("404/forbidden when the bill isn't the caller's (findFirst scoped by userId)", async () => {
    h.bill = null; // not found for this user
    expect((await POST(req({ provider: "KPN" }), ctx)).status).toBe(404);
    expect(h.updates).toHaveLength(0);
  });

  it("400 when nothing is provided", async () => {
    expect((await POST(req({}), ctx)).status).toBe(400);
  });

  it("corrects the monthly amount (drives comparison off it)", async () => {
    const res = await POST(req({ monthlyCents: 2995 }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.corrected).toContain("amount");
    expect(h.updates[0].monthlyCents).toBe(2995);
    expect(h.updates[0].amountCents).toBe(2995);
  });

  it("corrects provider + category together", async () => {
    const res = await POST(req({ provider: "Odido", category: "TELECOM" }), ctx);
    expect(res.status).toBe(200);
    expect(h.updates[0].provider).toBe("Odido");
    expect(h.updates[0].category).toBe("TELECOM");
  });

  it("rejects an AFM-gated category (verzekering/hypotheek)", async () => {
    expect((await POST(req({ category: "VERZEKERING" }), ctx)).status).toBe(400);
    expect((await POST(req({ category: "HYPOTHEEK" }), ctx)).status).toBe(400);
    expect(h.updates).toHaveLength(0);
  });

  it("rejects an unknown category + a non-positive amount", async () => {
    expect((await POST(req({ category: "BANANA" }), ctx)).status).toBe(400);
    expect((await POST(req({ monthlyCents: -5 }), ctx)).status).toBe(400);
  });
});
