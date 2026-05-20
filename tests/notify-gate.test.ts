import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * v21 DEEL 1 — the anti-spam send-gate. Every retention email must pass
 * through sendRetentionEmail: respects opt-out + requires an email +
 * honours a per-type throttle + always appends the unsubscribe footer.
 */

const h = vi.hoisted(() => ({
  sent: [] as Array<{ to: string; subject: string; html: string; text: string }>,
  userUpdate: vi.fn(async (a: { data: Record<string, unknown> }) => a),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (o: { to: string; subject: string; html: string; text: string }) => {
    h.sent.push(o);
    return { id: "x", skipped: false };
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: { user: { update: (a: { data: Record<string, unknown> }) => h.userUpdate(a) } },
}));

import { sendRetentionEmail, unsubscribeUrl } from "@/lib/notify";

function user(over: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "klant@voorbeeld.nl",
    name: "Klant",
    marketingOptOut: false,
    unsubscribeToken: "tok-123",
    ...over,
  } as Parameters<typeof sendRetentionEmail>[0]["user"];
}

const base = { subject: "Bespaar-tip", html: "<p>hoi</p>", text: "hoi" };

beforeEach(() => {
  h.sent = [];
  h.userUpdate.mockClear();
});

describe("v21 sendRetentionEmail gate", () => {
  it("does NOT send when the user opted out of marketing", async () => {
    const r = await sendRetentionEmail({ user: user({ marketingOptOut: true }), ...base });
    expect(r).toEqual({ sent: false, reason: "opted-out" });
    expect(h.sent).toHaveLength(0);
  });

  it("does NOT send when the user has no email", async () => {
    const r = await sendRetentionEmail({ user: user({ email: null }), ...base });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe("no-email");
    expect(h.sent).toHaveLength(0);
  });

  it("does NOT send when throttled inside the window", async () => {
    const r = await sendRetentionEmail({
      user: user(),
      ...base,
      throttle: { lastAt: new Date(Date.now() - 2 * 3600_000), minHours: 24 },
    });
    expect(r).toEqual({ sent: false, reason: "throttled" });
    expect(h.sent).toHaveLength(0);
  });

  it("DOES send when throttle window has passed", async () => {
    const r = await sendRetentionEmail({
      user: user(),
      ...base,
      throttle: { lastAt: new Date(Date.now() - 48 * 3600_000), minHours: 24 },
    });
    expect(r.sent).toBe(true);
    expect(h.sent).toHaveLength(1);
  });

  it("appends an unsubscribe link to both html + text", async () => {
    await sendRetentionEmail({ user: user(), ...base });
    expect(h.sent).toHaveLength(1);
    const url = unsubscribeUrl("tok-123");
    expect(h.sent[0].html).toContain(url);
    expect(h.sent[0].text).toContain(url);
  });

  it("mints an unsubscribe token when the user has none", async () => {
    await sendRetentionEmail({ user: user({ unsubscribeToken: null }), ...base });
    expect(h.userUpdate).toHaveBeenCalled();
    const data = h.userUpdate.mock.calls[0][0].data as { unsubscribeToken: string };
    expect(typeof data.unsubscribeToken).toBe("string");
    expect(data.unsubscribeToken.length).toBeGreaterThan(16);
  });
});
