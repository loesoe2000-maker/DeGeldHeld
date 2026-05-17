import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const upd = vi.fn();
const find = vi.fn();
vi.mock("../lib/db", () => ({
  prisma: {
    negotiation: {
      findFirst: (args: unknown) => find(args),
      update: (args: unknown) => upd(args),
    },
  },
}));

// Mock auth
const mockSession = vi.fn();
vi.mock("../lib/auth", () => ({
  auth: () => mockSession(),
}));

import { POST } from "../app/api/negotiations/[id]/feedback/route";

function makeReq(body: unknown): Request {
  return new Request("https://test/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/negotiations/[id]/feedback", () => {
  beforeEach(() => {
    upd.mockReset();
    find.mockReset();
    mockSession.mockReset();
  });

  it("401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeReq({ userRating: 1 }), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(401);
  });

  it("400 on invalid JSON", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    const req = new Request("https://t/x", { method: "POST", body: "not json" });
    const res = await POST(req, { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(400);
  });

  it("400 on invalid rating value", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeReq({ userRating: 99 }), { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(400);
  });

  it("404 when negotiation not owned", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    find.mockResolvedValue(null);
    const res = await POST(makeReq({ userRating: 1 }), { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(404);
  });

  it("200 + persist on valid thumbs-up", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    find.mockResolvedValue({ id: "n1" });
    upd.mockResolvedValue({ id: "n1" });
    const res = await POST(makeReq({ userRating: 1 }), { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(200);
    expect(upd).toHaveBeenCalledWith({ where: { id: "n1" }, data: { userRating: 1 } });
  });

  it("accepts mailUsed=true", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    find.mockResolvedValue({ id: "n1" });
    upd.mockResolvedValue({ id: "n1" });
    const res = await POST(makeReq({ mailUsed: true }), { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(200);
    expect(upd).toHaveBeenCalledWith({ where: { id: "n1" }, data: { mailUsed: true } });
  });

  it("accepts providerResponded=true", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    find.mockResolvedValue({ id: "n1" });
    upd.mockResolvedValue({ id: "n1" });
    const res = await POST(makeReq({ providerResponded: true }), { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(200);
  });

  it("accepts combined payload", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    find.mockResolvedValue({ id: "n1" });
    upd.mockResolvedValue({ id: "n1" });
    const res = await POST(makeReq({ userRating: -1, mailUsed: true, providerResponded: false }), { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(200);
    expect(upd).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { userRating: -1, mailUsed: true, providerResponded: false },
    });
  });
});
