import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalFlag = process.env.FEATURE_NO_CURE_NO_PAY;
const originalAdmins = process.env.ADMIN_EMAILS;

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === "subscriber")
          return { email: "sub@example.com", subscriptionStatus: "active" };
        if (where.id === "past_due")
          return { email: "pastdue@example.com", subscriptionStatus: "past_due" };
        if (where.id === "free")
          return { email: "free@example.com", subscriptionStatus: null };
        return null;
      }),
    },
  },
}));

import {
  shouldChargeVerifiedFee,
  hasActiveSubscription,
  SUBSCRIPTION_MONTHLY_CENTS,
} from "@/lib/payments";

describe("subscription bypass (v13 DEEL 7d)", () => {
  beforeEach(() => {
    process.env.FEATURE_NO_CURE_NO_PAY = "true";
    process.env.ADMIN_EMAILS = "";
  });
  afterEach(() => {
    process.env.FEATURE_NO_CURE_NO_PAY = originalFlag;
    process.env.ADMIN_EMAILS = originalAdmins;
  });

  it("subscription price is €4,99/maand", () => {
    expect(SUBSCRIPTION_MONTHLY_CENTS).toBe(499);
  });

  it("hasActiveSubscription returns true only for status='active'", () => {
    expect(hasActiveSubscription({ subscriptionStatus: "active" })).toBe(true);
    expect(hasActiveSubscription({ subscriptionStatus: "past_due" })).toBe(false);
    expect(hasActiveSubscription({ subscriptionStatus: "canceled" })).toBe(false);
    expect(hasActiveSubscription({ subscriptionStatus: null })).toBe(false);
    expect(hasActiveSubscription({})).toBe(false);
  });

  it("active subscriber → no fee charged", async () => {
    const r = await shouldChargeVerifiedFee({
      userId: "subscriber",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(false);
  });

  it("past_due subscriber → fee charged (subscription not actively covering)", async () => {
    const r = await shouldChargeVerifiedFee({
      userId: "past_due",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(true);
  });

  it("free user with savings above threshold → fee charged", async () => {
    const r = await shouldChargeVerifiedFee({
      userId: "free",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(true);
  });
});
