import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { verifyResendSignature, parseInboundPayload } from "@/lib/inbound";
import { verifyProofSignature, parseProofPayload, extractProofToken } from "@/lib/proof-inbound";
import { verifyInboundRouterSignature, parseInboundRouterPayload } from "@/lib/inbound-router";
import { discriminate } from "@/lib/auto-pingpong";

const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
});

function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// A cuid-like 24-char id that satisfies the [PROOF-...]/[NEGOTIATION-...] regex.
const CUID = "clz1234567890abcdefghijk";

describe("v20 DEEL 7a — every inbound webhook rejects unsigned payloads", () => {
  const cases: Array<[string, string, (b: string, s: string | null) => boolean]> = [
    ["RESEND_WEBHOOK_SECRET", "verifyResendSignature", verifyResendSignature],
    ["RESEND_PROOF_WEBHOOK_SECRET", "verifyProofSignature", verifyProofSignature],
    ["RESEND_INBOUND_SECRET", "verifyInboundRouterSignature", verifyInboundRouterSignature],
  ];

  for (const [envName, label, verify] of cases) {
    describe(label, () => {
      const body = JSON.stringify({ data: { from: "a@b.nl" } });

      beforeEach(() => {
        delete process.env[envName];
      });

      it("accepts a correctly-signed payload", () => {
        process.env[envName] = "shh";
        expect(verify(body, sign("shh", body))).toBe(true);
      });

      it("rejects a tampered body (signature no longer matches)", () => {
        process.env[envName] = "shh";
        const sig = sign("shh", body);
        expect(verify(body + "x", sig)).toBe(false);
      });

      it("rejects a missing signature header", () => {
        process.env[envName] = "shh";
        expect(verify(body, null)).toBe(false);
      });

      it("fail-closed: rejects everything when the secret is unset", () => {
        expect(verify(body, sign("shh", body))).toBe(false);
      });

      it("rejects a signature signed with the wrong secret", () => {
        process.env[envName] = "shh";
        expect(verify(body, sign("other-secret", body))).toBe(false);
      });
    });
  }
});

describe("v20 DEEL 7b — robust parsing of realistic Resend payloads", () => {
  it("inbound: parses a real envelope with attachments", () => {
    const payload = {
      type: "email.inbound",
      data: {
        from: { email: "Klant@Voorbeeld.NL" },
        subject: "Mijn factuur",
        text: "zie bijlage",
        attachments: [
          { filename: "factuur.pdf", content_type: "application/pdf", content: "QkFTRTY0" },
        ],
      },
    };
    const p = parseInboundPayload(payload);
    expect(p).not.toBeNull();
    expect(p!.from).toBe("klant@voorbeeld.nl"); // lowercased + extracted
    expect(p!.attachments).toHaveLength(1);
    expect(p!.attachments[0].contentType).toBe("application/pdf");
  });

  it("proof: matches the negotiation token in the subject + reads In-Reply-To", () => {
    const payload = {
      data: {
        from: "klant@voorbeeld.nl",
        subject: `Re: bewijs [PROOF-${CUID}]`,
        text: "nieuw bedrag €29,95 per maand",
        headers: { "In-Reply-To": "<thread-abc@degeldheld.com>" },
      },
    };
    const p = parseProofPayload(payload);
    expect(p).not.toBeNull();
    expect(p!.from).toBe("klant@voorbeeld.nl");
    expect(p!.inReplyTo).toBe("<thread-abc@degeldheld.com>");
    expect(extractProofToken(p!.subject)).toBe(CUID);
  });

  it("router discriminate: PROOF token → proof branch", () => {
    const intent = discriminate({ subject: `[PROOF-${CUID}]`, inReplyTo: null, references: null });
    expect(intent.kind).toBe("proof");
  });

  it("router discriminate: NEGOTIATION token → negotiation branch", () => {
    const intent = discriminate({ subject: `Re: [NEGOTIATION-${CUID}]`, inReplyTo: null, references: null });
    expect(intent.kind).toBe("negotiation");
  });

  it("router discriminate: In-Reply-To thread → negotiation via thread-id", () => {
    // extractThreadId requires a UUID-shaped id-left on the inbound domain.
    const intent = discriminate({
      subject: "Re: uw aanvraag",
      inReplyTo: "<550e8400-e29b-41d4-a716-446655440000@degeldheld.com>",
      references: null,
    });
    expect(intent.kind).toBe("negotiation");
  });

  it("spam / junk → no crash, routes to 'unknown' no-op", () => {
    expect(discriminate({ subject: "WIN A FREE IPHONE!!!", inReplyTo: null, references: null }).kind).toBe(
      "unknown",
    );
    // unparseable shapes return null rather than throwing
    expect(parseProofPayload(null)).toBeNull();
    expect(parseProofPayload("not an object")).toBeNull();
    expect(parseProofPayload({ data: {} })).toBeNull(); // no from-address
    expect(parseInboundPayload({ data: {} })).toBeNull();
    expect(parseInboundRouterPayload(42)).toBeNull();
  });
});

describe("v20 DEEL 7 — route handlers gate on the signature (source guard)", () => {
  const ROOT = resolve(__dirname, "..");
  const ROUTES: Array<[string, string]> = [
    ["app/api/inbound/route.ts", "verifyResendSignature"],
    ["app/api/inbound/proof/route.ts", "verifyProofSignature"],
    ["app/api/inbound/router/route.ts", "verifyInboundRouterSignature"],
  ];
  for (const [route, fn] of ROUTES) {
    it(`${route} calls ${fn} and returns 401 on failure`, () => {
      const s = readFileSync(resolve(ROOT, route), "utf8");
      expect(s).toMatch(new RegExp(`if \\(!${fn}\\(`));
      expect(s).toMatch(/status:\s*401/);
    });
  }
});
