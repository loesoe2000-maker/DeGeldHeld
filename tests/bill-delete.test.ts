import { describe, it, expect, vi, beforeEach } from "vitest";

const find = vi.fn();
const update = vi.fn(async (a: unknown) => a);
vi.mock("../lib/db", () => ({
  prisma: {
    bill: {
      findFirst: (a: unknown) => find(a),
      update: (a: unknown) => update(a),
    },
  },
}));

const mockSession = vi.fn();
vi.mock("../lib/auth", () => ({ auth: () => mockSession() }));

import { DELETE } from "../app/api/bills/[id]/route";

function req() {
  return new Request("https://t/x", { method: "DELETE" });
}

describe("DELETE /api/bills/[id]", () => {
  beforeEach(() => {
    find.mockReset();
    update.mockReset();
    mockSession.mockReset();
  });

  it("401 unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const r = await DELETE(req(), { params: Promise.resolve({ id: "b1" }) });
    expect(r.status).toBe(401);
  });

  it("404 when not owned", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    find.mockResolvedValue(null);
    const r = await DELETE(req(), { params: Promise.resolve({ id: "b1" }) });
    expect(r.status).toBe(404);
  });

  it("soft-deletes bill (sets deletedAt)", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    find.mockResolvedValue({ id: "b1" });
    const r = await DELETE(req(), { params: Promise.resolve({ id: "b1" }) });
    expect(r.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
