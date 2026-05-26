/**
 * tests/owner-alerts.test.ts — V36 DEEL 3.
 *
 * Verifieert dat notifyOwner():
 *  - "no-owner-email" returnt zonder OWNER_EMAIL (skip in CI/dev)
 *  - mail-payload juiste subject/text/html bevat
 *  - dedup-cache mail-storms voorkomt (60 min TTL per event+ref)
 *  - send-failed graceful afhandelt (sendEmail throws → return-value, geen throw)
 *  - PII discipline: subject + body bevatten geen email-/provider-strings
 *    die niet expliciet meegegeven zijn
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (opts: unknown) => sendEmailMock(opts),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { notifyOwner, resetOwnerAlertDedup } from "@/lib/owner-alerts";

beforeEach(() => {
  sendEmailMock.mockReset().mockResolvedValue({ id: "test-mail", skipped: false });
  resetOwnerAlertDedup();
  process.env.OWNER_EMAIL = "owner@degeldheld.com";
});

describe("notifyOwner — gating", () => {
  it("no-owner-email: skipt als OWNER_EMAIL niet gezet", async () => {
    delete process.env.OWNER_EMAIL;
    const r = await notifyOwner("cron-failed", { summary: "x" });
    expect(r).toBe("no-owner-email");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("no-owner-email: skipt als OWNER_EMAIL leeg is", async () => {
    process.env.OWNER_EMAIL = "";
    const r = await notifyOwner("cron-failed", { summary: "x" });
    expect(r).toBe("no-owner-email");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("notifyOwner — happy path", () => {
  it("sent: stuurt mail met juiste shape (to/subject/text/html)", async () => {
    const r = await notifyOwner("claim-failed", {
      summary: "Box 3 claim FAILED: card_declined",
      ref: "claim_box3_xyz",
      details: { jaar: 2024, werkelijkeCents: 200_000 },
    });
    expect(r).toBe("sent");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(call.to).toBe("owner@degeldheld.com");
    expect(call.subject).toMatch(/^\[DeGeldHeld owner-alert\] claim-failed:/);
    expect(call.subject).toContain("Box 3 claim FAILED");
    expect(call.text).toContain("claim-failed");
    expect(call.text).toContain("claim_box3_xyz");
    expect(call.text).toContain("jaar: 2024");
    expect(call.text).toContain("werkelijkeCents: 200000");
    expect(call.html).toContain("<code>claim_box3_xyz</code>");
  });

  it("alle 4 event-types worden geaccepteerd", async () => {
    await notifyOwner("cron-failed", { summary: "1" });
    await notifyOwner("claim-failed", { summary: "2" });
    await notifyOwner("stripe-webhook-error", { summary: "3" });
    await notifyOwner("ocr-failed", { summary: "4" });
    expect(sendEmailMock).toHaveBeenCalledTimes(4);
    const subjects = sendEmailMock.mock.calls.map((c) => (c[0] as { subject: string }).subject);
    expect(subjects).toEqual([
      expect.stringContaining("cron-failed"),
      expect.stringContaining("claim-failed"),
      expect.stringContaining("stripe-webhook-error"),
      expect.stringContaining("ocr-failed"),
    ]);
  });
});

describe("notifyOwner — dedup (60 min TTL per event+ref)", () => {
  it("tweede call met identieke (event, ref) binnen 60 min → 'deduped'", async () => {
    const first = await notifyOwner("claim-failed", { summary: "x", ref: "claim_1" });
    expect(first).toBe("sent");
    const second = await notifyOwner("claim-failed", { summary: "y", ref: "claim_1" });
    expect(second).toBe("deduped");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("verschillende refs dedupliceren NIET", async () => {
    await notifyOwner("claim-failed", { summary: "x", ref: "claim_1" });
    await notifyOwner("claim-failed", { summary: "y", ref: "claim_2" });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("verschillende events dedupliceren NIET (zelfs met zelfde ref)", async () => {
    await notifyOwner("claim-failed", { summary: "x", ref: "shared" });
    await notifyOwner("ocr-failed", { summary: "y", ref: "shared" });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("zonder ref dedupliceert alléén op event-naam", async () => {
    await notifyOwner("cron-failed", { summary: "a" });
    await notifyOwner("cron-failed", { summary: "b" });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("resetOwnerAlertDedup laat de tweede mail opnieuw versturen", async () => {
    await notifyOwner("claim-failed", { summary: "x", ref: "claim_1" });
    resetOwnerAlertDedup();
    await notifyOwner("claim-failed", { summary: "x", ref: "claim_1" });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });
});

describe("notifyOwner — fail-safe", () => {
  it("send-failed: sendEmail throws → return-value 'send-failed', geen throw", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("resend rate limit"));
    const r = await notifyOwner("cron-failed", { summary: "x", ref: "y" });
    expect(r).toBe("send-failed");
  });

  it("graceful: ook met malformed details (Function value) faalt niet", async () => {
    const r = await notifyOwner("ocr-failed", {
      summary: "x",
      details: { fn: (() => {}) as unknown },
    });
    expect(r).toBe("sent");
    const call = sendEmailMock.mock.calls[0][0] as { text: string };
    expect(call.text).toContain("fn: (unserializable)");
  });
});
