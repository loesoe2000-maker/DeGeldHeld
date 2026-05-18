import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  shouldChargeVerifiedFee,
  NO_CURE_NO_PAY_MIN_SAVINGS_CENTS,
} from "@/lib/payments";

const originalFlag = process.env.FEATURE_NO_CURE_NO_PAY;
const originalAdmins = process.env.ADMIN_EMAILS;

describe("shouldChargeVerifiedFee — flag gating", () => {
  beforeEach(() => {
    process.env.FEATURE_NO_CURE_NO_PAY = "false";
    process.env.ADMIN_EMAILS = "";
  });
  afterEach(() => {
    process.env.FEATURE_NO_CURE_NO_PAY = originalFlag;
    process.env.ADMIN_EMAILS = originalAdmins;
  });

  it("flag off → never charges, even for big savings", async () => {
    process.env.FEATURE_NO_CURE_NO_PAY = "false";
    const r = await shouldChargeVerifiedFee({
      userId: "u_nope",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(false);
  });

  it("flag missing → never charges", async () => {
    delete process.env.FEATURE_NO_CURE_NO_PAY;
    const r = await shouldChargeVerifiedFee({
      userId: "u_nope",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(false);
  });

  it("savings below threshold short-circuits before any DB read", async () => {
    process.env.FEATURE_NO_CURE_NO_PAY = "true";
    const r = await shouldChargeVerifiedFee({
      userId: "u_nope",
      actualSavingsCents: NO_CURE_NO_PAY_MIN_SAVINGS_CENTS - 1,
    });
    expect(r).toBe(false);
  });
});
