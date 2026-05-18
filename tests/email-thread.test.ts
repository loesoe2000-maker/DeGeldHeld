import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateThreadId,
  messageIdFor,
  extractThreadId,
  outboundThreadHeaders,
} from "@/lib/email-thread";

describe("email-thread / generateThreadId", () => {
  it("returns a UUID v4-shaped string", () => {
    const id = generateThreadId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("ids are unique across calls", () => {
    const a = generateThreadId();
    const b = generateThreadId();
    expect(a).not.toBe(b);
  });
});

describe("email-thread / messageIdFor", () => {
  it("formats as angle-bracketed RFC 5322 Message-ID", () => {
    const id = "abc12345-1111-4222-3333-444444444444";
    expect(messageIdFor(id)).toBe(`<${id}@degeldheld.com>`);
  });
});

describe("email-thread / extractThreadId", () => {
  const validId = "12345678-90ab-4cde-9012-345678901234";

  it("returns null for missing header", () => {
    expect(extractThreadId(null)).toBeNull();
    expect(extractThreadId(undefined)).toBeNull();
    expect(extractThreadId("")).toBeNull();
  });

  it("extracts thread-id from In-Reply-To header", () => {
    expect(extractThreadId(`<${validId}@degeldheld.com>`)).toBe(validId);
  });

  it("ignores foreign-domain Message-IDs", () => {
    expect(extractThreadId(`<${validId}@example.com>`)).toBeNull();
  });

  it("extracts the last id from a References chain (most recent ancestor)", () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const hdr = `<${id1}@degeldheld.com> <${id2}@degeldheld.com>`;
    expect(extractThreadId(hdr)).toBe(id2);
  });

  it("rejects non-UUID id-left", () => {
    expect(extractThreadId(`<not-a-uuid@degeldheld.com>`)).toBeNull();
  });
});

describe("email-thread / outboundThreadHeaders", () => {
  it("includes Message-ID always", () => {
    const id = "12345678-90ab-4cde-9012-345678901234";
    const hdrs = outboundThreadHeaders(id);
    expect(hdrs["Message-ID"]).toBe(`<${id}@degeldheld.com>`);
  });

  it("adds In-Reply-To + References when inReplyTo passed", () => {
    const id = "12345678-90ab-4cde-9012-345678901234";
    const inReply = "99999999-9999-4999-8999-999999999999";
    const hdrs = outboundThreadHeaders(id, inReply);
    expect(hdrs["In-Reply-To"]).toBe(`<${inReply}@degeldheld.com>`);
    expect(hdrs["References"]).toBe(`<${inReply}@degeldheld.com>`);
  });

  it("omits In-Reply-To when inReplyTo is null/undefined", () => {
    const id = "12345678-90ab-4cde-9012-345678901234";
    const hdrs = outboundThreadHeaders(id, null);
    expect("In-Reply-To" in hdrs).toBe(false);
  });
});
