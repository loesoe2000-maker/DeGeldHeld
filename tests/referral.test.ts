import { describe, it, expect, vi, beforeEach } from "vitest";

const userFind = vi.fn();
const userUpdate = vi.fn();
const refCreate = vi.fn();
vi.mock("../lib/db", () => ({
  prisma: {
    user: {
      findUnique: (a: unknown) => userFind(a),
      update: (a: unknown) => userUpdate(a),
    },
    referral: {
      create: (a: unknown) => refCreate(a),
    },
  },
}));

import {
  generateCode,
  isValidCode,
  ensureReferralCode,
  consumeReferral,
  buildShareUrl,
  buildShareText,
} from "../lib/referral";

describe("referral/generateCode", () => {
  it("returns 6-char string in safe alphabet", () => {
    const c = generateCode();
    expect(c).toHaveLength(6);
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });

  it("custom length", () => {
    expect(generateCode(8)).toHaveLength(8);
  });
});

describe("referral/isValidCode", () => {
  it("accepts 6-char alphanumeric", () => {
    expect(isValidCode("ABCD23")).toBe(true);
  });
  it("rejects lowercase", () => {
    expect(isValidCode("abcd23")).toBe(false);
  });
  it("rejects too-short", () => {
    expect(isValidCode("ABC")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isValidCode("")).toBe(false);
  });
});

describe("referral/ensureReferralCode", () => {
  beforeEach(() => {
    userFind.mockReset();
    userUpdate.mockReset();
  });

  it("returns existing code when user already has one", async () => {
    userFind.mockResolvedValue({ referralCode: "EXIST1" });
    const r = await ensureReferralCode("u1");
    expect(r).toBe("EXIST1");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("generates and persists when user has no code", async () => {
    userFind.mockResolvedValue({ referralCode: null });
    userUpdate.mockResolvedValue({});
    const r = await ensureReferralCode("u1");
    expect(r).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(userUpdate).toHaveBeenCalled();
  });
});

describe("referral/consumeReferral", () => {
  beforeEach(() => {
    userFind.mockReset();
    refCreate.mockReset();
  });

  it("returns null when code unknown", async () => {
    userFind.mockResolvedValue(null);
    const r = await consumeReferral("ZZZ123", "u2");
    expect(r).toBeNull();
  });

  it("returns null when owner == new user (self-referral block)", async () => {
    userFind.mockResolvedValue({ id: "u2" });
    const r = await consumeReferral("AAA123", "u2");
    expect(r).toBeNull();
  });

  it("creates referral with reward when valid", async () => {
    userFind.mockResolvedValue({ id: "u1" });
    refCreate.mockResolvedValue({ id: "ref-1" });
    const r = await consumeReferral("AAA123", "u2");
    expect(r).toBe("ref-1");
    expect(refCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "AAA123",
        ownerId: "u1",
        usedById: "u2",
        rewardCents: 499,
      }),
    });
  });
});

describe("referral/buildShareUrl + buildShareText", () => {
  it("share URL uses path /uitnodiging/<code>", () => {
    expect(buildShareUrl("ABC123")).toBe("https://degeldheld.com/uitnodiging/ABC123");
  });
  it("share URL respects base override", () => {
    expect(buildShareUrl("ABC123", "https://test.local")).toBe("https://test.local/uitnodiging/ABC123");
  });
  it("share text omits savings when zero", () => {
    expect(buildShareText("ABC123")).not.toContain("bespaarde");
  });
  it("share text includes savings when positive", () => {
    expect(buildShareText("ABC123", 250)).toContain("€250");
  });
});
