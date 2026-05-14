import { describe, it, expect } from "vitest";
import {
  welcomeBrandedHtml,
  magicLinkBrandedHtml,
  followUpBrandedHtml,
  followUpBrandedSubject,
} from "../lib/email_templates";

describe("email_templates/welcomeBrandedHtml", () => {
  it("includes email in greeting", () => {
    const html = welcomeBrandedHtml("user@example.nl");
    expect(html).toContain("user@example.nl");
  });

  it("uses brand green color in header", () => {
    const html = welcomeBrandedHtml("a@b.nl");
    expect(html).toContain("#059669");
  });

  it("includes DeGeldHeld logo text", () => {
    expect(welcomeBrandedHtml("a@b.nl")).toContain("DeGeldHeld");
  });

  it("escapes XSS in email", () => {
    const html = welcomeBrandedHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
  });

  it("starts with !doctype html", () => {
    expect(welcomeBrandedHtml("a@b.nl")).toMatch(/^<!doctype html>/i);
  });

  it("includes 15% messaging", () => {
    expect(welcomeBrandedHtml("a@b.nl")).toMatch(/15\s*%/);
  });

  it("includes copyright footer with current year", () => {
    const year = String(new Date().getFullYear());
    expect(welcomeBrandedHtml("a@b.nl")).toContain(year);
  });

  it("has preview text hidden span", () => {
    expect(welcomeBrandedHtml("a@b.nl")).toMatch(/display:none/i);
  });
});

describe("email_templates/magicLinkBrandedHtml", () => {
  it("includes the login URL", () => {
    const html = magicLinkBrandedHtml({ url: "https://x.com/auth/abc123", host: "x.com" });
    expect(html).toContain("https://x.com/auth/abc123");
  });

  it("includes inlogknop", () => {
    expect(magicLinkBrandedHtml({ url: "https://x", host: "x" })).toContain("Inloggen");
  });

  it("warns about not-attempted login", () => {
    expect(magicLinkBrandedHtml({ url: "https://x", host: "x" })).toMatch(/niet geprobeerd/i);
  });

  it("escapes URL params", () => {
    const html = magicLinkBrandedHtml({ url: 'https://x?q=<script>', host: "x" });
    expect(html).not.toContain("<script>");
  });
});

describe("email_templates/followUpBrandedHtml", () => {
  const input = {
    customerName: "Jan",
    provider: "Ziggo",
    negotiationId: "n1",
    expectedSavingsCents: 21600,
  };

  it("renders 3 outcome buttons with v2 NL labels", () => {
    const html = followUpBrandedHtml(input);
    expect(html).toMatch(/Ja gelukt/);
    expect(html).toMatch(/Niet gelukt/);
    expect(html).toMatch(/Nog wachten/);
  });

  it("includes outcome URL params", () => {
    const html = followUpBrandedHtml(input);
    expect(html).toMatch(/o=SUCCESS_SAVED/);
    expect(html).toMatch(/o=FAILED_NO_DEAL/);
    expect(html).toMatch(/o=STILL_WAITING/);
  });

  it("includes expected savings line", () => {
    const html = followUpBrandedHtml(input);
    expect(html).toMatch(/216/);
  });

  it("omits savings line when 0", () => {
    const html = followUpBrandedHtml({ ...input, expectedSavingsCents: 0 });
    expect(html).not.toMatch(/Verwachte besparing/);
  });

  it("escapes provider name", () => {
    const html = followUpBrandedHtml({ ...input, provider: "<bad>" });
    expect(html).not.toContain("<bad>");
    expect(html).toContain("&lt;bad&gt;");
  });

  it("escapes customer name", () => {
    const html = followUpBrandedHtml({ ...input, customerName: "<x>" });
    expect(html).toContain("&lt;x&gt;");
  });

  it("includes negotiation id in links", () => {
    expect(followUpBrandedHtml(input)).toContain("/onderhandel/n1/outcome");
  });
});

describe("email_templates/followUpBrandedSubject", () => {
  it("includes provider", () => {
    expect(followUpBrandedSubject("KPN")).toBe("Wat was de uitkomst met KPN?");
  });
});
