import { describe, it, expect } from "vitest";
import {
  feeForVerifiedSavings,
  shouldChargeVerifiedFee,
  NO_CURE_NO_PAY_FEE_PCT,
  NO_CURE_NO_PAY_FEE_CAP_CENTS,
} from "@/lib/payments";
import { computeBox3Fee } from "@/lib/box3-claim";
import { computeHuurFee } from "@/lib/huurcommissie";
import { computeEnergieFee } from "@/lib/energie-claim";

/**
 * v41 — DeGeldHeld is een GRATIS platform.
 *
 * Dit bestand borgde tot v40 dat de fee exact 20% was. Het is bewust
 * omgedraaid in plaats van verwijderd: het bewijst nu dat er langs geen
 * enkele rekenroute nog een bedrag bij de gebruiker in rekening komt.
 * De constanten blijven bestaan (historische rijen en types hangen eraan),
 * maar geen enkele rekenfunctie gebruikt ze nog.
 */

const BEDRAGEN = [0, 1, 2_500, 10_000, 25_000, 100_000, 1_000_000, 99_999_999];

describe("v41 — geen enkele fee-berekening geeft nog een bedrag", () => {
  it("feeForVerifiedSavings is 0, ongeacht de besparing", () => {
    for (const cents of BEDRAGEN) {
      expect(feeForVerifiedSavings(cents)).toBe(0);
    }
  });

  it("de drie claim-fees zijn 0, ongeacht de teruggave", () => {
    for (const cents of BEDRAGEN) {
      expect(computeBox3Fee(cents)).toBe(0);
      expect(computeHuurFee(cents)).toBe(0);
      expect(computeEnergieFee(cents)).toBe(0);
    }
  });

  it("shouldChargeVerifiedFee blijft false, óók met de oude env-vlag aan", async () => {
    const oud = process.env.FEATURE_NO_CURE_NO_PAY;
    process.env.FEATURE_NO_CURE_NO_PAY = "true";
    try {
      await expect(
        shouldChargeVerifiedFee({ userId: "u1", actualSavingsCents: 1_000_000 }),
      ).resolves.toBe(false);
    } finally {
      if (oud === undefined) delete process.env.FEATURE_NO_CURE_NO_PAY;
      else process.env.FEATURE_NO_CURE_NO_PAY = oud;
    }
  });

  it("de oude constanten bestaan nog (types/historie), maar sturen niets meer aan", () => {
    expect(NO_CURE_NO_PAY_FEE_PCT).toBe(0.2);
    expect(NO_CURE_NO_PAY_FEE_CAP_CENTS).toBe(50000);
    // Cruciaal: ondanks een percentage van 20% komt er 0 uit.
    expect(feeForVerifiedSavings(100_000)).toBe(0);
  });
});
