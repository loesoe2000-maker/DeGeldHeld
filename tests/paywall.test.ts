import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma before importing the lib under test.
const findFirst = vi.fn();
const billCount = vi.fn(async () => 0);
const referralCount = vi.fn(async () => 0);
vi.mock("../lib/db", () => ({
  prisma: {
    bill: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      count: (...a: unknown[]) => billCount(...a),
    },
    referral: {
      count: (...a: unknown[]) => referralCount(...a),
    },
  },
}));

import {
  requiresPayment,
  PAYWALL_FEE_CENTS,
  createPaywallCheckoutSession,
} from "../lib/payments";

beforeEach(() => findFirst.mockReset());

describe("PAYWALL_FEE_CENTS", () => {
  it("is €4.99", () => {
    expect(PAYWALL_FEE_CENTS).toBe(499);
  });
});

describe("requiresPayment", () => {
  it("first bill (position 0) is free", async () => {
    findFirst.mockResolvedValue({ position: 0, paidAt: null });
    expect(await requiresPayment("u1", "bill0")).toBe(false);
  });

  it("second bill (position 1) requires payment when not yet paid", async () => {
    findFirst.mockResolvedValue({ position: 1, paidAt: null });
    expect(await requiresPayment("u1", "bill1")).toBe(true);
  });

  it("second bill that is already paid does NOT require payment", async () => {
    findFirst.mockResolvedValue({ position: 1, paidAt: new Date() });
    expect(await requiresPayment("u1", "bill1")).toBe(false);
  });

  it("any bill at position >= 1 with no paidAt requires payment", async () => {
    findFirst.mockResolvedValue({ position: 7, paidAt: null });
    expect(await requiresPayment("u1", "bill7")).toBe(true);
  });

  it("unknown bill returns false (defensive — let caller redirect)", async () => {
    findFirst.mockResolvedValue(null);
    expect(await requiresPayment("u1", "nope")).toBe(false);
  });
});

describe("createPaywallCheckoutSession — no real Stripe key", () => {
  it("returns a test URL pointing back at /pay/[billId]", async () => {
    const co = await createPaywallCheckoutSession({
      userEmail: "u@example.nl",
      billId: "billX",
      appUrl: "https://test.example.nl",
    });
    expect(co.test).toBe(true);
    expect(co.amountCents).toBe(PAYWALL_FEE_CENTS);
    expect(co.url).toContain("/pay/billX");
  });
});
