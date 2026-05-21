import { describe, it, expect } from "vitest";
import { generateRelayToken, relayReplyTo, extractRelayToken } from "@/lib/relay";
import { messageIdFor, generateThreadId, extractThreadId } from "@/lib/email-thread";
import { relayFromHeader, fromAddress, fromDomain, isTestSender } from "@/lib/email-from";

/**
 * v25 DEEL 5b — deliverability of the relay round-trip. SPF/DKIM/DMARC on the
 * send domain are an ops/owner step (set in Resend; see V25_REPORT.md); here we
 * lock the parts a unit test CAN guarantee: the on-behalf From stays on the
 * verified domain (alignment), and every header we set round-trips so the
 * provider's reply routes back to the right negotiation.
 */
describe("relay deliverability — From alignment", () => {
  it("relayFromHeader keeps the bare address on the verified domain", () => {
    const header = relayFromHeader("Anne Jansen");
    // Display name makes the on-behalf relationship explicit…
    expect(header).toContain("via DeGeldHeld");
    // …but the address is the SAME verified-domain sender (SPF/DKIM aligned).
    expect(fromAddress(header)).toBe(fromAddress());
    expect(fromDomain(header)).toBe(fromDomain());
    expect(isTestSender(header)).toBe(false);
  });

  it("sanitizes a hostile customer name (no header injection)", () => {
    const header = relayFromHeader('Bad"<x>\nInjected: y');
    expect(header).not.toMatch(/[<>"]Injected/);
    expect(header).not.toContain("\n");
    // still a valid "Name <addr>" with the verified address intact
    expect(fromAddress(header)).toBe(fromAddress());
  });

  it("falls back to a neutral display name when the customer name is empty", () => {
    expect(relayFromHeader("")).toContain("een klant via DeGeldHeld");
  });
});

describe("relay deliverability — reply-to round-trips to the negotiation", () => {
  it("extractRelayToken recovers the token from the reply-to address", () => {
    const token = generateRelayToken();
    const replyTo = relayReplyTo(token);
    expect(replyTo).toMatch(/^onderhandel\+[A-Za-z0-9_-]+@/);
    expect(extractRelayToken([replyTo])).toBe(token);
  });

  it("a forged/unknown reply-to recipient yields no token", () => {
    expect(extractRelayToken(["random@kpn.nl", "info@kpn.nl"])).toBeNull();
  });
});

describe("relay deliverability — Message-ID / References thread round-trips", () => {
  it("References mirrors the Message-ID and extracts the same thread-id", () => {
    const threadId = generateThreadId();
    const messageId = messageIdFor(threadId);
    expect(messageId).toMatch(/^<[0-9a-f-]+@[^>]+>$/i);
    // References === Message-ID (what sendRelayMail sets) → thread recovers.
    expect(extractThreadId(messageId)).toBe(threadId);
  });
});
