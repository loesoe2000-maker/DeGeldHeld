import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v20 DEEL 6 — GDPR Article 17 deletion completeness.
 *
 * The route anonymises (keeps /proof aggregates) but must scrub every
 * field that could identify the person across every table hanging off the
 * user. We mock prisma, capture the $transaction operations, and assert the
 * scrub payloads null out the PII columns — table by table.
 */

const calls: Array<{ model: string; op: string; args: Record<string, unknown> }> = [];

function recorder(model: string, op: string) {
  return (args: Record<string, unknown>) => {
    calls.push({ model, op, args });
    return { __op: `${model}.${op}` };
  };
}

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user_1" } })),
}));

vi.mock("@/lib/db", () => {
  const m = (model: string) => ({
    update: recorder(model, "update"),
    updateMany: recorder(model, "updateMany"),
    deleteMany: recorder(model, "deleteMany"),
  });
  return {
    prisma: {
      $transaction: vi.fn(async (ops: unknown[]) => ops),
      user: m("user"),
      session: m("session"),
      account: m("account"),
      bill: m("bill"),
      negotiation: m("negotiation"),
      negotiationRound: m("negotiationRound"),
      outcomeProof: m("outcomeProof"),
      whatsAppThread: m("whatsAppThread"),
      whatsAppMessage: m("whatsAppMessage"),
      fraudFlag: m("fraudFlag"),
      waitlistEntry: m("waitlistEntry"),
      ocrTrainingSample: m("ocrTrainingSample"),
    },
  };
});

import { POST } from "@/app/api/account/delete/route";

function req(body: unknown) {
  return new Request("https://t/api/account/delete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function find(model: string, op: string) {
  return calls.find((c) => c.model === model && c.op === op);
}

beforeEach(() => {
  calls.length = 0;
});

describe("v20 GDPR deletion — confirmation gate", () => {
  it("400 without the exact confirmation phrase", async () => {
    const res = await POST(req({ confirm: "ja" }));
    expect(res.status).toBe(400);
    expect(calls.length).toBe(0);
  });

  it("200 with the exact phrase", async () => {
    const res = await POST(req({ confirm: "VERWIJDER MIJN ACCOUNT" }));
    expect(res.status).toBe(200);
  });
});

describe("v20 GDPR deletion — every PII surface is scrubbed", () => {
  beforeEach(async () => {
    await POST(req({ confirm: "VERWIJDER MIJN ACCOUNT" }));
  });

  it("user: email anonymised, name/image/verified/stripe ids cleared", () => {
    const d = find("user", "update")!.args.data as Record<string, unknown>;
    expect(String(d.email)).toMatch(/@example\.invalid$/);
    expect(d.name).toBeNull();
    expect(d.image).toBeNull();
    expect(d.emailVerified).toBeNull();
    expect(d.stripeCustomerId).toBeNull();
    expect(d.stripeSubscriptionId).toBeNull();
    expect(d.deletedAt).toBeInstanceOf(Date);
  });

  it("sessions + oauth accounts are deleted", () => {
    expect(find("session", "deleteMany")).toBeTruthy();
    expect(find("account", "deleteMany")).toBeTruthy();
  });

  it("bills: customerNumber / rawOcr / anonymousEmail cleared, soft-deleted", () => {
    const d = find("bill", "updateMany")!.args.data as Record<string, unknown>;
    expect(d.customerNumber).toBeNull();
    expect(d.rawOcr).toBeNull();
    expect(d.anonymousEmail).toBeNull();
    expect(d.deletedAt).toBeInstanceOf(Date);
  });

  it("negotiations: email subject/body + reasoning cleared", () => {
    const d = find("negotiation", "updateMany")!.args.data as Record<string, unknown>;
    expect(d.emailBody).toBeNull();
    expect(d.emailSubject).toBeNull();
    expect(d.reasoning).toBeNull();
  });

  it("negotiation rounds: provider/counter/OCR/analysis text cleared", () => {
    const c = find("negotiationRound", "updateMany")!;
    expect(c.args.where).toEqual({ negotiation: { is: { userId: "user_1" } } });
    const d = c.args.data as Record<string, unknown>;
    expect(d.providerResponse).toBeNull();
    expect(d.responseOcrText).toBeNull();
    expect(d.counterBody).toBeNull();
    expect(d.analysisJson).toBeNull();
  });

  it("outcome proofs: storageUrl + verifierNote cleared", () => {
    const d = find("outcomeProof", "updateMany")!.args.data as Record<string, unknown>;
    expect(d.storageUrl).toBeNull();
    expect(d.verifierNote).toBeNull();
  });

  it("whatsapp: phone numbers + message bodies cleared", () => {
    const t = find("whatsAppThread", "updateMany")!.args.data as Record<string, unknown>;
    expect(t.providerNumber).toBe("");
    expect(t.userPhoneNumber).toBeNull();
    const msg = find("whatsAppMessage", "updateMany")!.args.data as Record<string, unknown>;
    expect(msg.body).toBe("");
  });

  it("waitlist entry (raw email) is deleted", () => {
    expect(find("waitlistEntry", "deleteMany")!.args.where).toEqual({ userId: "user_1" });
  });

  it("ocr training samples are unlinked from the user", () => {
    const unlinks = calls.filter((c) => c.model === "ocrTrainingSample");
    expect(unlinks.length).toBeGreaterThanOrEqual(1);
    expect(unlinks.some((c) => (c.args.data as Record<string, unknown>).userId === null)).toBe(true);
  });
});
