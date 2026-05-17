import { describe, it, expect, vi, beforeEach } from "vitest";

const txn = vi.fn(async (ops: unknown[]) => ops);
const userUpdate = vi.fn(async (a: unknown) => a);
const sessDelete = vi.fn(async () => ({ count: 1 }));
const billUpdateMany = vi.fn(async () => ({ count: 2 }));

vi.mock("../lib/db", () => ({
  prisma: {
    $transaction: (ops: unknown[]) => txn(ops),
    user: { update: (a: unknown) => userUpdate(a) },
    session: { deleteMany: () => sessDelete() },
    bill: { updateMany: () => billUpdateMany() },
  },
}));

const mockSession = vi.fn();
vi.mock("../lib/auth", () => ({ auth: () => mockSession() }));

import { POST } from "../app/api/account/delete/route";

function req(body: unknown) {
  return new Request("https://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    txn.mockReset().mockImplementation(async (ops) => ops);
    userUpdate.mockReset();
    sessDelete.mockReset();
    billUpdateMany.mockReset();
    mockSession.mockReset();
  });

  it("401 unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const r = await POST(req({ confirm: "VERWIJDER MIJN ACCOUNT" }));
    expect(r.status).toBe(401);
  });

  it("400 on wrong confirm phrase", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(req({ confirm: "yes" }));
    expect(r.status).toBe(400);
  });

  it("400 on invalid JSON", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(new Request("https://t/x", { method: "POST", body: "garbage" }));
    expect(r.status).toBe(400);
  });

  it("200 + runs transaction with 3 ops on correct phrase", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(req({ confirm: "VERWIJDER MIJN ACCOUNT" }));
    expect(r.status).toBe(200);
    expect(txn).toHaveBeenCalledTimes(1);
    const ops = txn.mock.calls[0][0] as unknown[];
    expect(ops).toHaveLength(3);
  });
});
