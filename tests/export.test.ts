import { describe, it, expect, vi, beforeEach } from "vitest";

const userFind = vi.fn();
const billFind = vi.fn(async (): Promise<unknown[]> => []);
const negFind = vi.fn(async (): Promise<unknown[]> => []);
const payFind = vi.fn(async (): Promise<unknown[]> => []);
const waitFind = vi.fn(async (): Promise<unknown[]> => []);
const refFind = vi.fn(async (): Promise<unknown[]> => []);
const sessFind = vi.fn(async (): Promise<unknown[]> => []);

vi.mock("../lib/db", () => ({
  prisma: {
    user: { findUnique: (a: unknown) => userFind(a) },
    bill: { findMany: () => billFind() },
    negotiation: { findMany: () => negFind() },
    payment: { findMany: () => payFind() },
    waitlistEntry: { findMany: () => waitFind() },
    referral: { findMany: () => refFind() },
    session: { findMany: () => sessFind() },
  },
}));

const mockSession = vi.fn();
vi.mock("../lib/auth", () => ({ auth: () => mockSession() }));

import { GET } from "../app/api/account/export/route";

describe("GET /api/account/export", () => {
  beforeEach(() => {
    userFind.mockReset();
    billFind.mockReset().mockResolvedValue([]);
    negFind.mockReset().mockResolvedValue([]);
    payFind.mockReset().mockResolvedValue([]);
    waitFind.mockReset().mockResolvedValue([]);
    refFind.mockReset().mockResolvedValue([]);
    sessFind.mockReset().mockResolvedValue([]);
    mockSession.mockReset();
  });

  it("401 unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const r = await GET();
    expect(r.status).toBe(401);
  });

  it("200 + Content-Disposition attachment + correct shape", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-abc-xyz" } });
    userFind.mockResolvedValue({ id: "user-abc-xyz", email: "u@x.nl" });
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toMatch(/attachment/);
    expect(r.headers.get("content-disposition")).toMatch(/dgh-export-user-abc/);
    const body = await r.json();
    for (const key of ["exportedAt", "user", "bills", "negotiations", "payments", "waitlist", "referrals", "sessions"]) {
      expect(body).toHaveProperty(key);
    }
  });

  it("strips imageHash + rawOcr from bills", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    userFind.mockResolvedValue({ id: "u1", email: "u@x.nl" });
    billFind.mockResolvedValue([{ id: "b1", provider: "KPN" }]);
    const r = await GET();
    const body = await r.json();
    expect(body.bills[0]).not.toHaveProperty("imageHash");
    expect(body.bills[0]).not.toHaveProperty("rawOcr");
  });
});
