import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSession = vi.fn();
vi.mock("../../lib/auth", () => ({ auth: () => mockSession() }));

import { POST as connectPOST } from "../../app/api/psd2/connect/route";

describe("POST /api/psd2/connect", () => {
  beforeEach(() => {
    mockSession.mockReset();
    delete process.env.PSD2_ENABLED;
    process.env.TINK_CLIENT_ID = "test-client";
  });

  it("401 when not authenticated", async () => {
    mockSession.mockResolvedValue(null);
    process.env.PSD2_ENABLED = "true";
    const r = await connectPOST();
    expect(r.status).toBe(401);
  });

  it("503 when PSD2 not enabled", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    process.env.PSD2_ENABLED = "false";
    const r = await connectPOST();
    expect(r.status).toBe(503);
  });

  it("200 with Tink Link URL when enabled", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    process.env.PSD2_ENABLED = "true";
    const r = await connectPOST();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.url).toMatch(/link\.tink\.com/);
    expect(body.url).toContain("state=u1");
  });
});
