import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchDynamicAlternatives,
  clearDynamicAlternativesCache,
  dynamicAlternativesCacheSize,
  __setGroqChat,
} from "@/lib/dynamic_alternatives";

const chatMock = vi.fn();

beforeEach(() => {
  chatMock.mockReset();
  clearDynamicAlternativesCache();
  __setGroqChat(chatMock);
});

afterEach(() => {
  __setGroqChat(null);
});

function jsonResp(payload: unknown): string {
  return JSON.stringify(payload);
}

describe("dynamic_alternatives — happy path", () => {
  it("returns parsed alternatives from Groq", async () => {
    chatMock.mockResolvedValueOnce(
      jsonResp({
        alternatives: [
          { provider: "Free Mobile", plan: "Forfait 130GB", price_low_eur: 9.99, price_high_eur: 14.99, rationale: "Lowest forfait" },
          { provider: "Sosh", plan: "Mobile 100GB", price_low_eur: 12, price_high_eur: 16, rationale: "Orange budget brand" },
        ],
      }),
    );
    const alts = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: "Forfait Premium",
      country: "FR",
      currentMonthlyEur: 35,
    });
    expect(alts).toHaveLength(2);
    expect(alts[0].provider).toBe("Free Mobile");
    expect(alts[0].priceLowEur).toBe(9.99);
  });
});

describe("dynamic_alternatives — caching", () => {
  it("second call within 7d hits cache (no second Groq call)", async () => {
    chatMock.mockResolvedValueOnce(
      jsonResp({
        alternatives: [
          { provider: "X", plan: "Y", price_low_eur: 1, price_high_eur: 2, rationale: "ok" },
        ],
      }),
    );
    const a = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: "Premium",
      country: "FR",
      currentMonthlyEur: 30,
    });
    const b = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: "Premium",
      country: "FR",
      currentMonthlyEur: 30,
    });
    expect(a).toEqual(b);
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(dynamicAlternativesCacheSize()).toBe(1);
  });

  it("different plan → different cache key", async () => {
    chatMock.mockResolvedValue(
      jsonResp({
        alternatives: [
          { provider: "X", plan: "Y", price_low_eur: 1, price_high_eur: 2, rationale: "ok" },
        ],
      }),
    );
    await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: "A",
      country: "FR",
      currentMonthlyEur: 30,
    });
    await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: "B",
      country: "FR",
      currentMonthlyEur: 30,
    });
    expect(chatMock).toHaveBeenCalledTimes(2);
  });
});

describe("dynamic_alternatives — robustness", () => {
  it("returns [] on Groq timeout/error", async () => {
    chatMock.mockRejectedValueOnce(new Error("timeout"));
    const alts = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: null,
      country: "FR",
      currentMonthlyEur: 30,
    });
    expect(alts).toEqual([]);
  });

  it("returns [] on malformed JSON", async () => {
    chatMock.mockResolvedValueOnce("not json at all");
    const alts = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: null,
      country: "FR",
      currentMonthlyEur: 30,
    });
    expect(alts).toEqual([]);
  });

  it("filters out invalid entries (negative price)", async () => {
    chatMock.mockResolvedValueOnce(
      jsonResp({
        alternatives: [
          { provider: "A", plan: "P", price_low_eur: 10, price_high_eur: 15, rationale: "ok" },
          { provider: "B", plan: "P", price_low_eur: -1, price_high_eur: 2, rationale: "bad" },
        ],
      }),
    );
    const alts = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: null,
      country: "FR",
      currentMonthlyEur: 30,
    });
    expect(alts).toHaveLength(1);
    expect(alts[0].provider).toBe("A");
  });

  it("caps at 3 alternatives", async () => {
    chatMock.mockResolvedValueOnce(
      jsonResp({
        alternatives: Array.from({ length: 8 }, (_, i) => ({
          provider: `P${i}`,
          plan: "x",
          price_low_eur: 5,
          price_high_eur: 10,
          rationale: "ok",
        })),
      }),
    );
    const alts = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: null,
      country: "FR",
      currentMonthlyEur: 30,
    });
    expect(alts).toHaveLength(3);
  });

  it("no API key + no override → returns [] without calling Groq", async () => {
    __setGroqChat(null);
    const prev = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "gsk_test_dummy";
    const alts = await fetchDynamicAlternatives({
      provider: "Orange",
      category: "TELECOM",
      plan: null,
      country: "FR",
      currentMonthlyEur: 30,
    });
    expect(alts).toEqual([]);
    if (prev !== undefined) process.env.GROQ_API_KEY = prev;
    else delete process.env.GROQ_API_KEY;
  });
});
