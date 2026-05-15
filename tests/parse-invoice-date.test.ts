import { describe, it, expect } from "vitest";
import { parseInvoiceDate } from "../lib/ocr";

function ym(date: Date | null): string | null {
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

describe("parseInvoiceDate/NL month names", () => {
  it("'augustus 2020' → 2020-08", () => {
    expect(ym(parseInvoiceDate("augustus 2020"))).toBe("2020-08");
  });

  it("'Aug 2020' → 2020-08", () => {
    expect(ym(parseInvoiceDate("Aug 2020"))).toBe("2020-08");
  });

  it("'aug. 2020' → 2020-08 (handles trailing period)", () => {
    expect(ym(parseInvoiceDate("aug. 2020"))).toBe("2020-08");
  });

  it("'maart 2024' → 2024-03 (NL only)", () => {
    expect(ym(parseInvoiceDate("maart 2024"))).toBe("2024-03");
  });

  it("'mei 2026' → 2026-05", () => {
    expect(ym(parseInvoiceDate("mei 2026"))).toBe("2026-05");
  });

  it("'mrt 2024' → 2024-03 (NL abbrev)", () => {
    expect(ym(parseInvoiceDate("mrt 2024"))).toBe("2024-03");
  });
});

describe("parseInvoiceDate/EN month names", () => {
  it("'August 2020' → 2020-08", () => {
    expect(ym(parseInvoiceDate("August 2020"))).toBe("2020-08");
  });

  it("'March 2024' → 2024-03", () => {
    expect(ym(parseInvoiceDate("March 2024"))).toBe("2024-03");
  });
});

describe("parseInvoiceDate/DE month names", () => {
  it("'Mai 2020' → 2020-05", () => {
    expect(ym(parseInvoiceDate("Mai 2020"))).toBe("2020-05");
  });

  it("'Dezember 2023' → 2023-12", () => {
    expect(ym(parseInvoiceDate("Dezember 2023"))).toBe("2023-12");
  });

  it("'März 2024' → 2024-03 (umlaut)", () => {
    expect(ym(parseInvoiceDate("März 2024"))).toBe("2024-03");
  });

  it("'Marz 2024' → 2024-03 (ascii fallback)", () => {
    expect(ym(parseInvoiceDate("Marz 2024"))).toBe("2024-03");
  });
});

describe("parseInvoiceDate/numeric formats", () => {
  it("'2020-08' → 2020-08", () => {
    expect(ym(parseInvoiceDate("2020-08"))).toBe("2020-08");
  });

  it("'2020/08' → 2020-08", () => {
    expect(ym(parseInvoiceDate("2020/08"))).toBe("2020-08");
  });

  it("'08-2020' → 2020-08", () => {
    expect(ym(parseInvoiceDate("08-2020"))).toBe("2020-08");
  });

  it("'8/2020' → 2020-08 (single-digit month)", () => {
    expect(ym(parseInvoiceDate("8/2020"))).toBe("2020-08");
  });

  it("'2020-08-15' → 2020-08 (drops day)", () => {
    expect(ym(parseInvoiceDate("2020-08-15"))).toBe("2020-08");
  });
});

describe("parseInvoiceDate/null + invalid inputs", () => {
  it("null input → null", () => {
    expect(parseInvoiceDate(null)).toBeNull();
  });

  it("empty string → null", () => {
    expect(parseInvoiceDate("")).toBeNull();
  });

  it("undefined → null", () => {
    expect(parseInvoiceDate(undefined)).toBeNull();
  });

  it("'banana' → null (unknown month)", () => {
    expect(parseInvoiceDate("banana 2020")).toBeNull();
  });

  it("invalid month number (13) → null", () => {
    expect(parseInvoiceDate("2020-13")).toBeNull();
  });

  it("year out of range → null", () => {
    expect(parseInvoiceDate("aug 1800")).toBeNull();
  });

  it("garbage string → null", () => {
    expect(parseInvoiceDate("xyz")).toBeNull();
  });
});

describe("parseInvoiceDate/returns 1st of month UTC", () => {
  it("day is always 1", () => {
    const d = parseInvoiceDate("augustus 2020");
    expect(d?.getUTCDate()).toBe(1);
  });

  it("uses UTC (not local timezone) to avoid offset bugs", () => {
    const d = parseInvoiceDate("december 2020");
    expect(d?.getUTCMonth()).toBe(11); // 0-indexed Dec
    expect(d?.getUTCFullYear()).toBe(2020);
  });
});
