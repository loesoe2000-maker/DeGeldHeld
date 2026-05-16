import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockFind = vi.fn();
const mockAuth = vi.fn();

vi.mock("../lib/db", () => ({
  prisma: {
    negotiation: {
      update: (...a: unknown[]) => mockUpdate(...a),
      findUnique: (...a: unknown[]) => mockFind(...a),
    },
  },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      update: (...a: unknown[]) => mockUpdate(...a),
      findUnique: (...a: unknown[]) => mockFind(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: (...a: unknown[]) => mockAuth(...a),
}));
vi.mock("../lib/auth", () => ({
  auth: (...a: unknown[]) => mockAuth(...a),
}));

import { POST } from "../app/api/negotiations/outcome/route";
import { signOutcomeToken } from "@/lib/outcome_token";

function req(body: unknown): Request {
  return new Request("http://localhost/api/negotiations/outcome", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("api/negotiations/outcome POST", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockFind.mockReset();
    mockAuth.mockReset();
    process.env.OUTCOME_TOKEN_SECRET = "test-secret-32-bytes-or-more-pls-ok";
    // Default: findUnique returns row owned by user u1, no session — most tests
    // explicitly opt in to auth via mockAuth or pass a token.
    mockFind.mockResolvedValue({ id: "n1", userId: "u1", billId: "b1" });
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "x@y.nl" } });
  });

  it("400 on invalid JSON", async () => {
    const r = await POST(req("not-json") as never);
    expect(r.status).toBe(400);
  });

  it("400 on missing fields", async () => {
    const r = await POST(req({}) as never);
    expect(r.status).toBe(400);
  });

  it("400 on invalid outcome value", async () => {
    const r = await POST(req({ negotiationId: "n1", outcome: "WAT" }) as never);
    expect(r.status).toBe(400);
  });

  it("401 when no auth and no token", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const r = await POST(req({ negotiationId: "n1", outcome: "SUCCESS_SAVED" }) as never);
    expect(r.status).toBe(401);
  });

  it("transitions SUCCESS on SUCCESS_SAVED (session auth)", async () => {
    mockUpdate.mockResolvedValue({ state: "SUCCESS" });
    const r = await POST(
      req({ negotiationId: "n1", outcome: "SUCCESS_SAVED", actualSavingsCents: 21600 }) as never,
    );
    expect(r.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "SUCCESS", actualSavingsCents: 21600 }),
      }),
    );
  });

  it("token auth allows write without session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    mockUpdate.mockResolvedValue({ state: "SUCCESS" });
    const token = signOutcomeToken("b1");
    const r = await POST(
      req({
        negotiationId: "n1",
        outcome: "SUCCESS_SAVED",
        actualSavingsCents: 100,
        token,
      }) as never,
    );
    expect(r.status).toBe(200);
  });

  it("token for different billId is rejected", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const token = signOutcomeToken("b2"); // wrong bill
    const r = await POST(
      req({ negotiationId: "n1", outcome: "SUCCESS_SAVED", token }) as never,
    );
    expect(r.status).toBe(401);
  });

  it("transitions FAILED on FAILED_NO_DEAL", async () => {
    mockUpdate.mockResolvedValue({ state: "FAILED" });
    const r = await POST(req({ negotiationId: "n1", outcome: "FAILED_NO_DEAL" }) as never);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.state).toBe("FAILED");
  });

  it("stays AWAITING on STILL_WAITING", async () => {
    mockUpdate.mockResolvedValue({ state: "AWAITING" });
    const r = await POST(req({ negotiationId: "n1", outcome: "STILL_WAITING" }) as never);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.state).toBe("AWAITING");
  });

  it("404 when negotiation not found", async () => {
    mockFind.mockResolvedValue(null);
    const r = await POST(req({ negotiationId: "missing", outcome: "SUCCESS_SAVED" }) as never);
    expect(r.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not set actualSavings when outcome is failure", async () => {
    mockUpdate.mockResolvedValue({ state: "FAILED" });
    await POST(req({ negotiationId: "n1", outcome: "FAILED_NO_DEAL", actualSavingsCents: 100 }) as never);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actualSavingsCents: null }) }),
    );
  });
});
