import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifyInboundRouterSignature,
  parseInboundRouterPayload,
} from "@/lib/inbound-router";

describe("inbound-router / verifyInboundRouterSignature", () => {
  const SECRET = "test-secret-bytes-32-chars-padding-x";

  it("rejects unsigned body", () => {
    process.env.RESEND_INBOUND_SECRET = SECRET;
    expect(verifyInboundRouterSignature("{}", null)).toBe(false);
    expect(verifyInboundRouterSignature("{}", "")).toBe(false);
  });

  it("rejects when secret env var is missing", () => {
    delete process.env.RESEND_INBOUND_SECRET;
    expect(verifyInboundRouterSignature("{}", "abcd")).toBe(false);
  });

  it("rejects when signature does not match", () => {
    process.env.RESEND_INBOUND_SECRET = SECRET;
    expect(verifyInboundRouterSignature("{}", "00".repeat(32))).toBe(false);
  });

  it("accepts a correctly-signed body", () => {
    process.env.RESEND_INBOUND_SECRET = SECRET;
    const body = JSON.stringify({ hello: "world" });
    const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyInboundRouterSignature(body, sig)).toBe(true);
  });

  it("rejects malformed hex signature", () => {
    process.env.RESEND_INBOUND_SECRET = SECRET;
    expect(verifyInboundRouterSignature("{}", "zzz-not-hex")).toBe(false);
  });
});

describe("inbound-router / parseInboundRouterPayload", () => {
  it("returns null for non-object input", () => {
    expect(parseInboundRouterPayload(null)).toBeNull();
    expect(parseInboundRouterPayload(42)).toBeNull();
    expect(parseInboundRouterPayload("foo")).toBeNull();
  });

  it("returns null when from address is missing", () => {
    expect(parseInboundRouterPayload({ subject: "x" })).toBeNull();
  });

  it("parses flat shape", () => {
    const r = parseInboundRouterPayload({
      from: "retentie@kpn.nl",
      subject: "Re: korting",
      text: "We bieden 25% korting.",
      headers: {
        "In-Reply-To": "<11111111-1111-4111-8111-111111111111@degeldheld.com>",
        "Message-ID": "<rep@kpn.nl>",
      },
    });
    expect(r).not.toBeNull();
    expect(r!.from).toBe("retentie@kpn.nl");
    expect(r!.subject).toBe("Re: korting");
    expect(r!.inReplyTo).toContain("11111111-1111-4111-8111-111111111111");
    expect(r!.messageId).toBe("<rep@kpn.nl>");
  });

  it("normalizes from-address to lowercase", () => {
    const r = parseInboundRouterPayload({
      from: " RETENTIE@KPN.NL ",
      subject: "x",
      text: "y",
    });
    expect(r!.from).toBe("retentie@kpn.nl");
  });

  it("supports nested data envelope", () => {
    const r = parseInboundRouterPayload({
      type: "email.inbound",
      data: { from: { email: "rep@vodafone.nl" }, subject: "Re:", text: "Hi" },
    });
    expect(r).not.toBeNull();
    expect(r!.from).toBe("rep@vodafone.nl");
  });
});
