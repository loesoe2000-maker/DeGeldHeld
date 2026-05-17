import { describe, it, expect } from "vitest";
import { detectRecurring } from "../../lib/psd2/detect-bills";
import type { TinkTransaction } from "../../lib/psd2/tink";

function tx(opts: { date: string; amount: number; name: string }): TinkTransaction {
  return {
    id: Math.random().toString(36).slice(2),
    accountId: "a1",
    amount: { value: opts.amount, currencyCode: "EUR" },
    bookedDateTime: new Date(opts.date).toISOString(),
    descriptions: { display: opts.name, original: opts.name },
    counterParties: { payee: { name: opts.name } },
  };
}

describe("psd2/detect-bills", () => {
  it("detects KPN €25/mnd recurring", () => {
    const txns: TinkTransaction[] = [
      tx({ date: "2026-02-01", amount: -25.0, name: "KPN" }),
      tx({ date: "2026-03-01", amount: -25.0, name: "KPN" }),
      tx({ date: "2026-04-01", amount: -25.5, name: "KPN" }),
    ];
    const out = detectRecurring(txns);
    expect(out.length).toBe(1);
    expect(out[0].counterpartyName).toMatch(/KPN/i);
    expect(out[0].monthlyCents).toBeGreaterThan(2400);
    expect(out[0].monthlyCents).toBeLessThan(2600);
    expect(out[0].category).toBe("TELECOM");
  });

  it("detects Eneco €120/mnd", () => {
    const txns: TinkTransaction[] = [
      tx({ date: "2026-02-01", amount: -120.0, name: "Eneco" }),
      tx({ date: "2026-03-01", amount: -120.0, name: "Eneco" }),
    ];
    const out = detectRecurring(txns);
    expect(out.length).toBe(1);
    expect(out[0].category).toBe("ENERGIE");
    expect(out[0].monthlyCents).toBe(12000);
  });

  it("ignores one-off purchases", () => {
    const txns: TinkTransaction[] = [
      tx({ date: "2026-02-01", amount: -84.0, name: "Bol.com" }),
    ];
    expect(detectRecurring(txns)).toHaveLength(0);
  });

  it("ignores credits (positive amounts)", () => {
    const txns: TinkTransaction[] = [
      tx({ date: "2026-02-01", amount: 25.0, name: "KPN refund" }),
      tx({ date: "2026-03-01", amount: 25.0, name: "KPN refund" }),
    ];
    expect(detectRecurring(txns)).toHaveLength(0);
  });

  it("rejects bi-yearly cadence (gap too wide)", () => {
    const txns: TinkTransaction[] = [
      tx({ date: "2026-02-01", amount: -100, name: "Year-thing" }),
      tx({ date: "2026-08-01", amount: -100, name: "Year-thing" }),
    ];
    expect(detectRecurring(txns)).toHaveLength(0);
  });

  it("accepts ±5% amount drift across months", () => {
    const txns: TinkTransaction[] = [
      tx({ date: "2026-02-01", amount: -25.0, name: "Wifi" }),
      tx({ date: "2026-03-01", amount: -25.4, name: "Wifi" }),
      tx({ date: "2026-04-01", amount: -25.7, name: "Wifi" }),
    ];
    expect(detectRecurring(txns)).toHaveLength(1);
  });

  it("groups by normalized name (case + punctuation)", () => {
    const txns: TinkTransaction[] = [
      tx({ date: "2026-02-01", amount: -10, name: "KPN" }),
      tx({ date: "2026-03-01", amount: -10, name: "kpn." }),
    ];
    expect(detectRecurring(txns).length).toBe(1);
  });
});
