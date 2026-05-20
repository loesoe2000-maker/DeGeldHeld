import { describe, it, expect } from "vitest";
import { parseReceivedEvent } from "@/lib/resend-receiving";

/**
 * DEEL 2 — the parser must read Resend's REAL `email.received` envelope
 * (metadata only: email_id, from, to[], subject, message_id, attachment
 * metadata). Body/headers/attachment-content are fetched separately.
 */

// The example payload shape from Resend's docs (webhooks/emails/received).
const REAL_EVENT = {
  type: "email.received",
  created_at: "2026-02-22T23:41:12.126Z",
  data: {
    email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
    from: "klant@voorbeeld.nl",
    to: ["inbox@degeldheld.com"],
    cc: [],
    bcc: [],
    message_id: "<example+123>",
    subject: "Mijn KPN factuur",
    attachments: [
      { id: "2a0c9ce0-3112-4728-976e-47ddcd16a318", filename: "factuur.pdf", content_type: "application/pdf", content_disposition: "inline", content_id: "img001" },
    ],
  },
};

describe("DEEL 2 — parseReceivedEvent on the real Resend schema", () => {
  it("extracts email_id, from, to[], subject, message_id + attachment metadata", () => {
    const m = parseReceivedEvent(REAL_EVENT);
    expect(m).not.toBeNull();
    expect(m!.emailId).toBe("56761188-7520-42d8-8898-ff6fc54ce618");
    expect(m!.from).toBe("klant@voorbeeld.nl");
    expect(m!.to).toEqual(["inbox@degeldheld.com"]);
    expect(m!.subject).toBe("Mijn KPN factuur");
    expect(m!.messageId).toBe("<example+123>");
    expect(m!.attachments).toHaveLength(1);
    expect(m!.attachments[0]).toMatchObject({ id: "2a0c9ce0-3112-4728-976e-47ddcd16a318", contentType: "application/pdf" });
  });

  it("normalises a 'Name <addr>' from and lowercases recipients", () => {
    const m = parseReceivedEvent({
      type: "email.received",
      data: { email_id: "e1", from: "Klant <Klant@Voorbeeld.NL>", to: ["Bewijs@DeGeldHeld.com"] },
    });
    expect(m!.from).toBe("klant@voorbeeld.nl");
    expect(m!.to).toEqual(["bewijs@degeldheld.com"]);
  });

  it("rejects a non-email.received event type", () => {
    expect(parseReceivedEvent({ type: "email.delivered", data: { email_id: "e", from: "a@b.nl" } })).toBeNull();
  });

  it("rejects a payload missing email_id or from", () => {
    expect(parseReceivedEvent({ type: "email.received", data: { from: "a@b.nl" } })).toBeNull();
    expect(parseReceivedEvent({ type: "email.received", data: { email_id: "e" } })).toBeNull();
    expect(parseReceivedEvent(null)).toBeNull();
    expect(parseReceivedEvent("garbage")).toBeNull();
  });
});
