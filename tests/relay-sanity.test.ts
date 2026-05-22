import { describe, it, expect } from "vitest";
import { relayAddressSanity, relayDomainLooksOff } from "@/lib/relay";

/**
 * v26 DEEL 3 — address sanity. Hard-reject no-reply / malformed mailboxes
 * before the first relay send; domain-mismatch is advisory only.
 */
describe("relayAddressSanity — hard rejects", () => {
  it("rejects no-reply / do-not-reply mailboxes", () => {
    for (const e of [
      "noreply@kpn.com",
      "no-reply@kpn.com",
      "donotreply@vodafone.nl",
      "do-not-reply@ziggo.nl",
      "NoReply@Engie.com",
    ]) {
      const r = relayAddressSanity(e);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe("noreply");
    }
  });

  it("rejects a malformed address", () => {
    for (const e of ["not-an-email", "x@y", "@kpn.nl", "a@b.", ""]) {
      expect(relayAddressSanity(e).ok).toBe(false);
    }
  });

  it("allows a normal customer-service address", () => {
    for (const e of ["retentie@kpn.nl", "klantenservice@vodafone.nl", "vragen@greenchoice.nl"]) {
      expect(relayAddressSanity(e)).toEqual({ ok: true });
    }
  });

  it("does not mistake a normal local-part containing 'reply' for no-reply", () => {
    // word-boundary anchored at the START — 'replies@' is fine, 'noreply@' is not.
    expect(relayAddressSanity("replyteam@kpn.nl").ok).toBe(true);
  });
});

describe("relayDomainLooksOff — advisory only", () => {
  it("flags a domain that has nothing to do with the provider", () => {
    expect(relayDomainLooksOff("info@randomzzz.com", "Vattenfall")).toBe(true);
  });
  it("does NOT flag a matching domain", () => {
    expect(relayDomainLooksOff("vattenfall@vattenfall.nl", "Vattenfall")).toBe(false);
    expect(relayDomainLooksOff("klantenservice.nl@engie.com", "Engie")).toBe(false);
  });
  it("never flags when the provider name is too short to judge", () => {
    expect(relayDomainLooksOff("a@b.nl", "NS")).toBe(false);
  });
});
