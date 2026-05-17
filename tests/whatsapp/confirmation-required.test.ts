import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const updMsg = vi.fn(async (a: unknown) => a);
vi.mock("../../lib/db", () => ({
  prisma: {
    whatsAppMessage: {
      findUnique: (a: unknown) => findUnique(a),
      update: (a: unknown) => updMsg(a),
    },
  },
}));

const mockSession = vi.fn();
vi.mock("../../lib/auth", () => ({ auth: () => mockSession() }));

import { POST } from "../../app/api/outbound/whatsapp/route";

function makeReq(body: unknown) {
  return new Request("https://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  findUnique.mockReset();
  updMsg.mockReset();
  mockSession.mockReset();
  process.env.WHATSAPP_ENABLED = "true";
  process.env.TWILIO_ACCOUNT_SID = "AC1";
  process.env.TWILIO_AUTH_TOKEN = "tok1";
});

describe("POST /api/outbound/whatsapp", () => {
  it("401 unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const r = await POST(makeReq({ messageId: "m1" }));
    expect(r.status).toBe(401);
  });

  it("503 when WHATSAPP_ENABLED=false", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    process.env.WHATSAPP_ENABLED = "false";
    const r = await POST(makeReq({ messageId: "m1" }));
    expect(r.status).toBe(503);
  });

  it("400 on invalid body", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(400);
  });

  it("404 when message not owned by user", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue({
      id: "m1",
      pendingApproval: true,
      direction: "outbound",
      body: "x",
      thread: { providerNumber: "+31x", ourNumber: "+31y", negotiation: { userId: "OTHER" } },
    });
    const r = await POST(makeReq({ messageId: "m1" }));
    expect(r.status).toBe(404);
  });

  it("400 when message not pending approval", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue({
      id: "m1",
      pendingApproval: false,
      direction: "outbound",
      body: "x",
      thread: { providerNumber: "+31x", ourNumber: "+31y", negotiation: { userId: "u1" } },
    });
    const r = await POST(makeReq({ messageId: "m1" }));
    expect(r.status).toBe(400);
  });
});
