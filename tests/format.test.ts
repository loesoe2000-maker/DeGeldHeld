import { describe, it, expect } from "vitest";
import { formatEurCents, formatPercent, formatRelativeDate, parseEurInput } from "../lib/format";

describe("format/formatEurCents", () => {
  it("formats whole euros", () => {
    expect(formatEurCents(1500)).toMatch(/15,00/);
  });

  it("uses comma as decimal separator (NL)", () => {
    expect(formatEurCents(1234)).toContain(",");
  });

  it("includes € symbol", () => {
    expect(formatEurCents(100)).toMatch(/€/);
  });

  it("hides decimals when requested", () => {
    expect(formatEurCents(1500, { showDecimals: false })).not.toMatch(/,00/);
  });
});

describe("format/formatPercent", () => {
  it("formats percent with NL locale", () => {
    expect(formatPercent(0.5)).toMatch(/50,0\s*%/);
  });
  it("respects fractionDigits", () => {
    expect(formatPercent(0.333, 2)).toMatch(/33,30\s*%/);
  });
});

describe("format/formatRelativeDate", () => {
  const now = new Date("2026-05-14T12:00:00Z");

  it("zojuist for very recent", () => {
    expect(formatRelativeDate(new Date("2026-05-14T11:59:30Z"), now)).toBe("zojuist");
  });
  it("minutes geleden", () => {
    expect(formatRelativeDate(new Date("2026-05-14T11:30:00Z"), now)).toBe("30 min geleden");
  });
  it("uur geleden", () => {
    expect(formatRelativeDate(new Date("2026-05-14T07:00:00Z"), now)).toMatch(/uur geleden/);
  });
  it("dagen plural", () => {
    expect(formatRelativeDate(new Date("2026-05-12T12:00:00Z"), now)).toBe("2 dagen geleden");
  });
  it("dag singular", () => {
    expect(formatRelativeDate(new Date("2026-05-13T12:00:00Z"), now)).toBe("1 dag geleden");
  });
  it("weken", () => {
    expect(formatRelativeDate(new Date("2026-05-01T12:00:00Z"), now)).toMatch(/wk/);
  });
});

describe("format/parseEurInput", () => {
  it("parses NL comma decimal", () => {
    expect(parseEurInput("15,70")).toBe(1570);
  });

  it("parses US dot decimal", () => {
    expect(parseEurInput("15.70")).toBe(1570);
  });

  it("strips € prefix", () => {
    expect(parseEurInput("€ 15,70")).toBe(1570);
    expect(parseEurInput("€15,70")).toBe(1570);
  });

  it("handles thousands separator (NL: . thousands, , decimal)", () => {
    expect(parseEurInput("1.234,56")).toBe(123456);
  });

  it("handles thousands separator (US: , thousands, . decimal)", () => {
    expect(parseEurInput("1,234.56")).toBe(123456);
  });

  it("returns null for empty input", () => {
    expect(parseEurInput("")).toBeNull();
    expect(parseEurInput("  ")).toBeNull();
  });

  it("returns null for non-numeric", () => {
    expect(parseEurInput("abc")).toBeNull();
  });

  it("handles whole numbers", () => {
    expect(parseEurInput("15")).toBe(1500);
  });
});
