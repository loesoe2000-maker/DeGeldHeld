import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalFlag = process.env.FEATURE_NO_CURE_NO_PAY;
const originalAdmins = process.env.ADMIN_EMAILS;

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === "admin_user") return { email: "admin@degeldheld.com" };
        if (where.id === "regular_user") return { email: "regular@example.com" };
        return null;
      }),
    },
  },
}));

import { shouldChargeVerifiedFee } from "@/lib/payments";

describe("admin-bypass on no-cure-no-pay fee", () => {
  beforeEach(() => {
    process.env.FEATURE_NO_CURE_NO_PAY = "true";
    process.env.ADMIN_EMAILS = "admin@degeldheld.com,other@admin.com";
  });
  afterEach(() => {
    process.env.FEATURE_NO_CURE_NO_PAY = originalFlag;
    process.env.ADMIN_EMAILS = originalAdmins;
  });

  it("admin user is never charged", async () => {
    const r = await shouldChargeVerifiedFee({
      userId: "admin_user",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(false);
  });

  it("regular user IS charged when flag on + savings ≥ threshold", async () => {
    const r = await shouldChargeVerifiedFee({
      userId: "regular_user",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(true);
  });

  it("admin-list is case-insensitive", async () => {
    process.env.ADMIN_EMAILS = "ADMIN@DEGELDHELD.COM";
    const r = await shouldChargeVerifiedFee({
      userId: "admin_user",
      actualSavingsCents: 100_000,
    });
    expect(r).toBe(false);
  });
});
