import { describe, it, expect } from "vitest";
import { followUpHtml, followUpSubject } from "../lib/follow_up_email";

describe("follow_up_email/followUpSubject", () => {
  it("includes provider", () => {
    expect(followUpSubject("KPN")).toBe("Wat was de uitkomst met KPN?");
  });
});

describe("follow_up_email/followUpHtml", () => {
  const input = {
    customerName: "Jan",
    provider: "Ziggo",
    expectedSavingsCents: 21600,
    negotiationId: "n1",
    appUrl: "https://degeldheld.com",
  };

  it("renders 3 outcome buttons", () => {
    const html = followUpHtml(input);
    expect(html).toMatch(/SUCCESS_SAVED/);
    expect(html).toMatch(/FAILED_NO_DEAL/);
    expect(html).toMatch(/STILL_WAITING/);
  });

  it("includes provider name", () => {
    expect(followUpHtml(input)).toContain("Ziggo");
  });

  it("uses negotiationId in links", () => {
    expect(followUpHtml(input)).toContain("/onderhandel/n1/outcome");
  });

  it("escapes provider name", () => {
    const html = followUpHtml({ ...input, provider: "<bad>" });
    expect(html).not.toContain("<bad>");
    expect(html).toContain("&lt;bad&gt;");
  });

  it("escapes customer name", () => {
    const html = followUpHtml({ ...input, customerName: `<script>` });
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses appUrl in links", () => {
    expect(followUpHtml(input)).toContain("https://degeldheld.com/onderhandel/n1/outcome");
  });

  it("is HTML5", () => {
    expect(followUpHtml(input)).toMatch(/^<!doctype html>/i);
  });
});
