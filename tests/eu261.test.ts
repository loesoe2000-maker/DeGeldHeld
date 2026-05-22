/**
 * tests/eu261.test.ts — EU261-compensatie (pure calculator).
 *
 * Geverifieerd tegen docs/BENEFITS_DATA_2026.md (Europa.eu + EUclaim).
 * Bands: € 250 (≤1500 km, ≥3u) · € 400 (1500-3500 km, ≥3u) · € 600 (>3500 km, ≥4u).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eu261Compensation, EU261, type Eu261Input } from "@/lib/eu261";

function base(overrides: Partial<Eu261Input> = {}): Eu261Input {
  return {
    distanceKm: 1000,
    delayMinutes: 200,
    withinEU: true,
    extraordinaryCircumstances: false,
    ...overrides,
  };
}

describe("eu261 — short haul (≤ 1.500 km)", () => {
  it("≥ 3 u vertraging → € 250", () => {
    const r = eu261Compensation(base({ distanceKm: 800, delayMinutes: 200 }));
    expect(r.eligible).toBe(true);
    expect(r.band).toBe("short");
    expect(r.amountCents).toBe(25_000);
  });

  it("op de 3u-grens → wel recht", () => {
    const r = eu261Compensation(base({ distanceKm: 800, delayMinutes: 180 }));
    expect(r.eligible).toBe(true);
  });

  it("< 3 u → géén recht", () => {
    const r = eu261Compensation(base({ distanceKm: 800, delayMinutes: 175 }));
    expect(r.eligible).toBe(false);
    expect(r.amountCents).toBe(0);
  });

  it("grens 1.500 km telt als short (≤)", () => {
    const r = eu261Compensation(base({ distanceKm: 1500, delayMinutes: 200 }));
    expect(r.band).toBe("short");
  });
});

describe("eu261 — medium haul (1.500-3.500 km)", () => {
  it("EU-vlucht > 1.500 km, ≥ 3 u → € 400", () => {
    const r = eu261Compensation(base({ distanceKm: 2500, delayMinutes: 200, withinEU: true }));
    expect(r.eligible).toBe(true);
    expect(r.band).toBe("medium");
    expect(r.amountCents).toBe(40_000);
  });

  it("niet-EU 1.500-3.500 km, ≥ 3 u → € 400", () => {
    const r = eu261Compensation(base({ distanceKm: 3000, delayMinutes: 200, withinEU: false }));
    expect(r.eligible).toBe(true);
    expect(r.amountCents).toBe(40_000);
  });

  it("< 3 u → geen recht (medium)", () => {
    const r = eu261Compensation(base({ distanceKm: 2500, delayMinutes: 170 }));
    expect(r.eligible).toBe(false);
  });

  it("grens 3.500 km telt nog als medium", () => {
    const r = eu261Compensation(base({ distanceKm: 3500, delayMinutes: 200 }));
    expect(r.band).toBe("medium");
  });
});

describe("eu261 — long haul (> 3.500 km)", () => {
  it("≥ 4 u → € 600", () => {
    const r = eu261Compensation(base({ distanceKm: 6000, delayMinutes: 260 }));
    expect(r.eligible).toBe(true);
    expect(r.band).toBe("long");
    expect(r.amountCents).toBe(60_000);
  });

  it("op 4u-grens → wel € 600", () => {
    const r = eu261Compensation(base({ distanceKm: 6000, delayMinutes: 240 }));
    expect(r.eligible).toBe(true);
    expect(r.amountCents).toBe(60_000);
  });

  it("3-4 u op long haul → géén vol recht (uitleg verwijst naar specialist)", () => {
    const r = eu261Compensation(base({ distanceKm: 6000, delayMinutes: 200 }));
    expect(r.eligible).toBe(false);
    expect(r.amountCents).toBe(0);
    expect(r.reden).toMatch(/specialist|gehalveerd/i);
  });

  it("< 3 u long haul → géén recht", () => {
    const r = eu261Compensation(base({ distanceKm: 6000, delayMinutes: 150 }));
    expect(r.eligible).toBe(false);
  });
});

describe("eu261 — buitengewone omstandigheden + invalide input", () => {
  it("buitengewone omstandigheden → geen recht ongeacht vertraging", () => {
    const r = eu261Compensation(
      base({ distanceKm: 6000, delayMinutes: 600, extraordinaryCircumstances: true }),
    );
    expect(r.eligible).toBe(false);
    expect(r.reden).toMatch(/buitengewon/i);
  });

  it("afstand 0 of negatief → geen recht (onbekende data)", () => {
    const r = eu261Compensation(base({ distanceKm: 0 }));
    expect(r.eligible).toBe(false);
    expect(r.reden).toMatch(/afstand/i);
  });

  it("vertraging negatief / NaN → geen recht", () => {
    const r = eu261Compensation(base({ delayMinutes: Number.NaN }));
    expect(r.eligible).toBe(false);
  });
});

describe("eu261 — data-integriteit", () => {
  const src = readFileSync(resolve(__dirname, "../lib/eu261.ts"), "utf8");

  it("constants matchen docs/BENEFITS_DATA_2026.md", () => {
    expect(EU261.payShortCents).toBe(25_000);
    expect(EU261.payMediumCents).toBe(40_000);
    expect(EU261.payLongCents).toBe(60_000);
    expect(EU261.shortHaulKm).toBe(1500);
    expect(EU261.longHaulKm).toBe(3500);
    expect(EU261.delayShortMin).toBe(180);
    expect(EU261.delayLongMin).toBe(240);
    expect(EU261.verjaringJaren).toBe(2);
  });

  it("verwijst expliciet naar de bron-van-waarheid + sourcet de EU-bronnen", () => {
    expect(src).toMatch(/BENEFITS_DATA_2026\.md/);
    expect(src).toMatch(/Europa\.eu/i);
    expect(src).toMatch(/EUclaim/i);
  });
});
