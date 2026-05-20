import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FetchedEmail } from "@/lib/resend-receiving";

/**
 * DEEL 3 — the canonical /api/inbound handler. We mock the verification +
 * the Resend fetch layer + dispatch, and assert routing: signature gate,
 * proof/negotiation via dispatch, bewijs@ from-fallback, inbox@ bill-OCR,
 * and junk → 200 no-op.
 */

const h = vi.hoisted(() => ({
  verifyOk: true,
  email: null as FetchedEmail | null,
  dispatchResult: { kind: "unknown" } as { kind: string; [k: string]: unknown },
  userFor: null as { id: string; email: string } | null,
  negotiation: null as Record<string, unknown> | null,
  recordProof: vi.fn(async (_a?: unknown) => ({ proofId: "p1", verdict: { verdict: "verified" } })),
  billCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: "b1", provider: a.data.provider, amountCents: a.data.amountCents })),
  billFindUnique: vi.fn(async (): Promise<unknown> => null),
  sendEmail: vi.fn(async (_a?: unknown) => ({ id: "noop", skipped: true })),
}));

vi.mock("@/lib/inbound-verify", () => ({
  verifyResendWebhook: () => h.verifyOk,
}));

vi.mock("@/lib/resend-receiving", async () => {
  const actual = await vi.importActual<typeof import("@/lib/resend-receiving")>("@/lib/resend-receiving");
  return {
    ...actual, // keep the real parseReceivedEvent
    fetchReceivedEmail: vi.fn(async () => h.email),
    fetchAttachmentBuffer: vi.fn(async () => ({ contentType: "image/jpeg", buffer: Buffer.from("img") })),
  };
});

vi.mock("@/lib/auto-pingpong", () => ({
  dispatch: vi.fn(async () => h.dispatchResult),
}));

vi.mock("@/lib/inbound", () => ({
  userForFromAddress: vi.fn(async () => h.userFor),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: { findFirst: vi.fn(async () => h.negotiation) },
    bill: {
      findUnique: () => h.billFindUnique(),
      count: vi.fn(async () => 0),
      create: (a: { data: Record<string, unknown> }) => h.billCreate(a),
    },
  },
}));

vi.mock("@/lib/ocr", () => ({
  extractBill: vi.fn(async () => ({
    provider: "KPN", category: "TELECOM", amountCents: 2965, monthlyAmountCents: 2965,
    totalAmountCents: 2965, plan: "Compleet", period: "mei 2026", customerNumber: null,
    country: "NL", rawText: "stub",
  })),
  hashImage: vi.fn(() => "hash"),
  parseInvoiceDate: vi.fn(() => null),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: (a: unknown) => h.sendEmail(a),
  escapeHtml: (s: string) => s,
}));

vi.mock("@/lib/format", () => ({ currencyForCountry: () => "EUR" }));

vi.mock("@/lib/outcome-proof", () => ({ recordProof: (a: unknown) => h.recordProof(a) }));

import { handleInbound } from "@/lib/inbound-handler";

function makeReq(event: unknown): Request {
  return new Request("https://t/api/inbound", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
}

function email(over: Partial<FetchedEmail>): FetchedEmail {
  return {
    emailId: "e1", from: "klant@voorbeeld.nl", to: ["inbox@degeldheld.com"], subject: "",
    text: "", html: "", headers: {}, messageId: null, inReplyTo: null, references: null,
    attachments: [], ...over,
  };
}
const event = (over: Record<string, unknown> = {}) => ({
  type: "email.received",
  data: { email_id: "e1", from: "klant@voorbeeld.nl", to: ["inbox@degeldheld.com"], ...over },
});

beforeEach(() => {
  h.verifyOk = true;
  h.email = email({});
  h.dispatchResult = { kind: "unknown" };
  h.userFor = null;
  h.negotiation = null;
  h.recordProof.mockClear();
  h.billCreate.mockClear();
  h.billFindUnique.mockReset().mockResolvedValue(null);
  h.sendEmail.mockClear();
});

describe("canonical /api/inbound handler", () => {
  it("401 on invalid Svix signature", async () => {
    h.verifyOk = false;
    const res = await handleInbound(makeReq(event()));
    expect(res.status).toBe(401);
  });

  it("200 no-op on a non-email.received event", async () => {
    const res = await handleInbound(makeReq({ type: "email.delivered", data: {} }));
    expect(res.status).toBe(200);
    expect((await res.json()).reason).toMatch(/not an email.received/);
  });

  it("502 when the email body cannot be fetched (transient → Resend retries)", async () => {
    h.email = null;
    const res = await handleInbound(makeReq(event()));
    expect(res.status).toBe(502);
  });

  it("proof/negotiation by token → routed via dispatch", async () => {
    h.dispatchResult = { kind: "proof", ok: true, proofId: "p1" };
    h.email = email({ subject: "Re: [PROOF-clz1234567890abcdefghijk]" });
    const res = await handleInbound(makeReq(event({ subject: "Re: [PROOF-clz1234567890abcdefghijk]" })));
    expect(res.status).toBe(200);
    expect((await res.json()).routed).toBe("proof");
  });

  it("bewijs@ without token → proof-by-from fallback (recordProof)", async () => {
    h.dispatchResult = { kind: "unknown" };
    h.email = email({ to: ["bewijs@degeldheld.com"], text: "nieuw bedrag €29,95" });
    h.negotiation = {
      id: "n1",
      user: { email: "klant@voorbeeld.nl" },
      bill: { monthlyCents: 4000, amountCents: 4000 },
    };
    const res = await handleInbound(makeReq(event({ to: ["bewijs@degeldheld.com"] })));
    expect(res.status).toBe(200);
    expect(h.recordProof).toHaveBeenCalled();
  });

  it("inbox@ + known sender + image attachment → bill created", async () => {
    h.userFor = { id: "u1", email: "klant@voorbeeld.nl" };
    h.email = email({
      to: ["inbox@degeldheld.com"],
      attachments: [{ id: "a1", filename: "kpn.jpg", contentType: "image/jpeg" }],
    });
    const res = await handleInbound(makeReq(event()));
    expect(res.status).toBe(200);
    expect(h.billCreate).toHaveBeenCalled();
    expect((await res.json()).processed).toBe(1);
  });

  it("inbox@ + unknown sender → 200, signup reply, no bill", async () => {
    h.userFor = null;
    h.email = email({ attachments: [{ id: "a1", filename: "x.jpg", contentType: "image/jpeg" }] });
    const res = await handleInbound(makeReq(event()));
    expect(res.status).toBe(200);
    expect((await res.json()).sender).toBe("unknown");
    expect(h.billCreate).not.toHaveBeenCalled();
  });

  it("junk mail (no token/thread/attachment, unknown recipient) → 200 no match", async () => {
    h.email = email({ to: ["random@degeldheld.com"], subject: "WIN A PRIZE", attachments: [] });
    const res = await handleInbound(makeReq(event({ to: ["random@degeldheld.com"] })));
    expect(res.status).toBe(200);
    expect((await res.json()).reason).toBe("no match");
  });
});
