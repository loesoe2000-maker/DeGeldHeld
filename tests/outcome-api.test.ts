import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
vi.mock("../lib/db", () => ({
  prisma: {
    negotiation: { update: (...a: unknown[]) => mockUpdate(...a) },
  },
}));

import { POST } from "../app/api/negotiations/outcome/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/negotiations/outcome", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("api/negotiations/outcome POST", () => {
  beforeEach(() => mockUpdate.mockReset());

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

  it("transitions SUCCESS on SUCCESS_SAVED", async () => {
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
    mockUpdate.mockRejectedValue(new Error("not found"));
    const r = await POST(req({ negotiationId: "missing", outcome: "SUCCESS_SAVED" }) as never);
    expect(r.status).toBe(404);
  });

  it("does not set actualSavings when outcome is failure", async () => {
    mockUpdate.mockResolvedValue({ state: "FAILED" });
    await POST(req({ negotiationId: "n1", outcome: "FAILED_NO_DEAL", actualSavingsCents: 100 }) as never);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actualSavingsCents: null }) }),
    );
  });
});
