import { describe, it, expect } from "vitest";
import { parseInboundRouterPayload } from "@/lib/inbound-router";

// Signature verification moved to lib/inbound-verify.ts (Svix) — see
// tests/inbound-handler.test.ts. This file now only covers the parser.

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
