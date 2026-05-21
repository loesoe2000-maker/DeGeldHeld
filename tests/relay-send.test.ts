import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v23 DEEL 2 — relay outbound. Consent-gated; on-behalf with reply-to token,
 * subject [NEGOTIATION-id], stable thread.
 */

const h = vi.hoisted(() => ({
  neg: null as Record<string, unknown> | null,
  sent: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findUnique: vi.fn(async () => h.neg),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.updates.push(a.data);
        return {};
      }),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (o: Record<string, unknown>) => {
    h.sent.push(o);
    return { id: "msg_1", skipped: false };
  }),
  escapeHtml: (s: string) => s,
}));

import { sendRelayMail } from "@/lib/relay-send";

function negFixture(over: Record<string, unknown> = {}) {
  return {
    id: "neg_1",
    relayAuthorizedAt: new Date(),
    relayState: "RELAY_ACTIVE",
    relayToken: "tok_abc123",
    providerEmail: "retentie@kpn.nl",
    providerThreadId: null,
    bill: { provider: "KPN" },
    user: { name: "Anne Jansen" },
    ...over,
  };
}

beforeEach(() => {
  h.neg = negFixture();
  h.sent = [];
  h.updates = [];
});

describe("v23 sendRelayMail — consent gate (GUARDRAIL 1)", () => {
  it("does NOT send without authorization", async () => {
    h.neg = negFixture({ relayAuthorizedAt: null });
    const r = await sendRelayMail({ negotiationId: "neg_1", subject: "x", body: "y", kind: "first" });
    expect(r.ok).toBe(false);
    expect(h.sent).toHaveLength(0);
  });

  it("does NOT send when relay is paused (not RELAY_ACTIVE)", async () => {
    h.neg = negFixture({ relayState: "PAUSED" });
    const r = await sendRelayMail({ negotiationId: "neg_1", subject: "x", body: "y", kind: "first" });
    expect(r.ok).toBe(false);
    expect(h.sent).toHaveLength(0);
  });

  it("does NOT send without a provider address", async () => {
    h.neg = negFixture({ providerEmail: null });
    const r = await sendRelayMail({ negotiationId: "neg_1", subject: "x", body: "y", kind: "first" });
    expect(r).toMatchObject({ ok: false, reason: "no-provider-address" });
    expect(h.sent).toHaveLength(0);
  });
});

describe("v23 sendRelayMail — on-behalf send shape", () => {
  it("sends to the provider with reply-to token + [NEGOTIATION-id] subject + thread + 'namens'", async () => {
    const r = await sendRelayMail({
      negotiationId: "neg_1",
      subject: "Verzoek tariefherziening KPN",
      body: "Beste KPN, ik wil graag een lager tarief.",
      kind: "first",
    });
    expect(r.ok).toBe(true);
    expect(h.sent).toHaveLength(1);
    const mail = h.sent[0];
    expect(mail.to).toBe("retentie@kpn.nl");
    expect(mail.replyTo).toBe("onderhandel+tok_abc123@degeldheld.com");
    expect(String(mail.subject)).toContain("[NEGOTIATION-neg_1]");
    expect(String(mail.text)).toContain("namens Anne Jansen");
    expect((mail.headers as Record<string, string>)["Message-ID"]).toMatch(/@degeldheld\.com>$/);
    // thread persisted + first send marks EMAIL_SENT
    expect(h.updates[0].providerThreadId).toBeTruthy();
    expect(h.updates[0].state).toBe("EMAIL_SENT");
  });

  it("a counter send increments the auto-rounds loop-guard", async () => {
    h.neg = negFixture({ providerThreadId: "11111111-1111-4111-8111-111111111111" });
    await sendRelayMail({ negotiationId: "neg_1", subject: "Counter", body: "Kan dit lager?", kind: "counter" });
    expect(h.updates[0].relayAutoRounds).toEqual({ increment: 1 });
  });
});
