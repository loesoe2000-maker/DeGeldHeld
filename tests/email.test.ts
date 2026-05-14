import { describe, it, expect, vi } from "vitest";
import { escapeHtml, welcomeEmailHtml, sendEmail } from "../lib/email";

describe("email/escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });
  it("escapes quotes", () => {
    expect(escapeHtml(`"x" 'y'`)).toBe("&quot;x&quot; &#39;y&#39;");
  });
  it("leaves plain text unchanged", () => {
    expect(escapeHtml("hello")).toBe("hello");
  });
});

describe("email/welcomeEmailHtml", () => {
  it("includes the email in the body", () => {
    const html = welcomeEmailHtml("user@example.nl");
    expect(html).toContain("user@example.nl");
  });

  it("escapes XSS in email", () => {
    const html = welcomeEmailHtml(`"><script>alert(1)</script>`);
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
  });

  it("is valid HTML doctype", () => {
    expect(welcomeEmailHtml("a@b.nl")).toMatch(/^<!doctype html>/i);
  });
});

describe("email/sendEmail", () => {
  it("returns skipped=true when API key is dummy", async () => {
    const r = await sendEmail({ to: "x@y.nl", subject: "s", html: "<p>h</p>" });
    expect(r.skipped).toBe(true);
  });
});
