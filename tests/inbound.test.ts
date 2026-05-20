import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// Pin secret BEFORE any imports that read it.
process.env.RESEND_WEBHOOK_SECRET = "test-secret";

const userFind = vi.fn();
const billCount = vi.fn(async () => 0);
const billFindUnique = vi.fn(async (): Promise<unknown> => null);
const billCreate = vi.fn(async (a: { data: Record<string, unknown> }) => ({
  id: "b1",
  provider: a.data.provider,
  amountCents: a.data.amountCents,
}));
vi.mock("../lib/db", () => ({
  prisma: {
    user: { findUnique: (a: unknown) => userFind(a) },
    bill: {
      count: () => billCount(),
      findUnique: () => billFindUnique(),
      create: (a: { data: Record<string, unknown> }) => billCreate(a),
    },
  },
}));

vi.mock("../lib/ocr", async () => {
  const actual = await vi.importActual<typeof import("../lib/ocr")>("../lib/ocr");
  return {
    ...actual,
    extractBill: vi.fn(async () => ({
      ok: true,
      provider: "KPN",
      category: "TELECOM",
      monthlyAmountCents: 2965,
      totalAmountCents: 2965,
      amountCents: 2965,
      oneTimeItems: [],
      plan: "Compleet",
      period: "mei 2026",
      customerNumber: null,
      language: "nl",
      country: "NL",
      confidence: 0.92,
      rawText: "stub",
      imageHash: "abc",
      attempts: 1,
    })),
  };
});

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn(async () => ({ id: "noop", skipped: true })),
  // v20: inbound reply now escapes the provider name in the HTML body.
  escapeHtml: (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;"),
}));

import { POST } from "../app/api/inbound/route";
import {
  verifyResendSignature,
  parseInboundPayload,
} from "../lib/inbound";

function sign(body: string): string {
  return crypto.createHmac("sha256", "test-secret").update(body).digest("hex");
}

function makeReq(body: unknown, sig?: string): Request {
  const raw = JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  if (sig !== undefined) headers.set("resend-signature", sig);
  else headers.set("resend-signature", sign(raw));
  return new Request("https://t/inbound", { method: "POST", headers, body: raw });
}

beforeEach(() => {
  userFind.mockReset();
  billCount.mockReset().mockResolvedValue(0);
  billFindUnique.mockReset().mockResolvedValue(null);
  billCreate.mockReset().mockImplementation(async (a) => ({
    id: "b1",
    provider: a.data.provider,
    amountCents: a.data.amountCents,
  }));
});

describe("verifyResendSignature", () => {
  it("accepts a correct hmac", () => {
    const body = "hello";
    expect(verifyResendSignature(body, sign(body))).toBe(true);
  });
  it("rejects empty signature", () => {
    expect(verifyResendSignature("hello", null)).toBe(false);
  });
  it("rejects wrong signature", () => {
    expect(verifyResendSignature("hello", "deadbeef")).toBe(false);
  });
});

describe("parseInboundPayload", () => {
  it("extracts from-string + subject + attachments", () => {
    const p = parseInboundPayload({
      data: {
        from: "user@example.com",
        subject: "factuur",
        text: "zie bijlage",
        attachments: [{ filename: "bill.jpg", content_type: "image/jpeg", content: "Zm9v" }],
      },
    });
    expect(p?.from).toBe("user@example.com");
    expect(p?.attachments).toHaveLength(1);
  });
  it("extracts from-object shape", () => {
    const p = parseInboundPayload({
      from: { email: "user@example.com" },
      attachments: [],
    });
    expect(p?.from).toBe("user@example.com");
  });
  it("returns null when no from-address", () => {
    expect(parseInboundPayload({})).toBeNull();
  });
});

describe("POST /api/inbound", () => {
  it("401 on invalid signature", async () => {
    const req = makeReq({ from: "u@x.nl" }, "0000");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("400 when no attachments", async () => {
    userFind.mockResolvedValue({ id: "u1", email: "u@x.nl" });
    const req = makeReq({ data: { from: "u@x.nl", subject: "", text: "", attachments: [] } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("unknown sender → 200, replied, no DB write", async () => {
    userFind.mockResolvedValue(null);
    const req = makeReq({
      data: {
        from: "stranger@x.nl",
        subject: "",
        text: "",
        attachments: [{ filename: "x.jpg", content_type: "image/jpeg", content: "Zm9v" }],
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sender).toBe("unknown");
    expect(billCreate).not.toHaveBeenCalled();
  });

  it("known sender + image attachment → bill created", async () => {
    userFind.mockResolvedValue({ id: "u1", email: "u@x.nl" });
    const req = makeReq({
      data: {
        from: "u@x.nl",
        subject: "factuur",
        text: "",
        attachments: [{ filename: "kpn.jpg", content_type: "image/jpeg", content: "Zm9v" }],
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(billCreate).toHaveBeenCalled();
    const body = await res.json();
    expect(body.processed).toBe(1);
  });

  it("dedupe — same imageHash → reuse existing bill", async () => {
    userFind.mockResolvedValue({ id: "u1", email: "u@x.nl" });
    billFindUnique.mockResolvedValue({ id: "b-old", provider: "KPN", amountCents: 2965 });
    const req = makeReq({
      data: {
        from: "u@x.nl",
        attachments: [{ filename: "kpn.jpg", content_type: "image/jpeg", content: "Zm9v" }],
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(billCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.processed).toBe(1);
  });

  it("non-image attachment skipped → 400 no-supported", async () => {
    userFind.mockResolvedValue({ id: "u1", email: "u@x.nl" });
    const req = makeReq({
      data: {
        from: "u@x.nl",
        attachments: [{ filename: "tx.txt", content_type: "text/plain", content: "Zm9v" }],
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
