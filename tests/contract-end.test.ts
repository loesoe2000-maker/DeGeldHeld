import { describe, it, expect } from "vitest";
import { contractEndFromOcr, parseNlDate } from "@/lib/contract-end";

describe("v21 contract-end detection", () => {
  it("parses NL numeric + named dates", () => {
    expect(parseNlDate("31-12-2027")?.toISOString().slice(0, 10)).toBe("2027-12-31");
    expect(parseNlDate("1/3/27")?.toISOString().slice(0, 10)).toBe("2027-03-01");
    expect(parseNlDate("12 januari 2027")?.toISOString().slice(0, 10)).toBe("2027-01-12");
    expect(parseNlDate("geen datum")).toBeNull();
  });

  it("detects an explicit end-date in the OCR text (not estimated)", () => {
    const r = contractEndFromOcr({
      rawText: "Uw contract loopt tot 30-06-2027. Bedankt.",
      invoiceDate: new Date("2026-01-01"),
    });
    expect(r.estimated).toBe(false);
    expect(r.date?.toISOString().slice(0, 10)).toBe("2027-06-30");
  });

  it("detects 'einde looptijd' phrasing", () => {
    const r = contractEndFromOcr({ rawText: "Einde looptijd: 15 maart 2027", invoiceDate: null });
    expect(r.estimated).toBe(false);
    expect(r.date?.toISOString().slice(0, 10)).toBe("2027-03-15");
  });

  it("estimates invoiceDate + 12 months when no end-date is found", () => {
    const r = contractEndFromOcr({ rawText: "gewone factuur zonder einddatum", invoiceDate: new Date("2026-05-01") });
    expect(r.estimated).toBe(true);
    expect(r.date?.toISOString().slice(0, 10)).toBe("2027-05-01");
  });

  it("returns null (no alert) when neither a date nor an invoiceDate is available", () => {
    const r = contractEndFromOcr({ rawText: "niks", invoiceDate: null });
    expect(r.date).toBeNull();
  });
});
