import { describe, it, expect } from "vitest";
import { analyseProviderResponse, __setSleepImpl } from "@/lib/rounds";

/**
 * Without spinning up Prisma, we exercise the analyse step that
 * drives the auto-pingpong branch. Three mock replies cover the
 * tones the router cares about: constructief, afwijzend, stalling.
 *
 * The full DB-touching round of the dispatch() function is exercised
 * via a separate integration test (out of scope for unit-suite).
 */
describe("auto-pingpong flow / 3 mock replies (v12 DEEL 1e)", () => {
  // Make sure the retry sleep doesn't slow the suite down.
  __setSleepImpl(async () => {});

  it("constructief: 'we kunnen €25 aanbieden' → counter action", async () => {
    const a = await analyseProviderResponse(
      "Beste klant, na overleg kunnen we u een nieuw maandtarief aanbieden van €25,00. We rekenen op uw reactie.",
    );
    expect(["constructief", "stalling"]).toContain(a.tone);
    expect(["counter", "accept"]).toContain(a.action);
    expect(a.offeredCents).toBe(2500);
  });

  it("afwijzend: 'helaas geen mogelijkheid' → walk_away action", async () => {
    const a = await analyseProviderResponse(
      "Helaas hebben we momenteel geen mogelijkheid om uw tarief verder te verlagen. Onze prijzen zijn al scherp.",
    );
    expect(a.tone).toBe("afwijzend");
    expect(a.action).toBe("walk_away");
    expect(a.offers).toBe(false);
  });

  it("stalling: 'we hebben meer informatie nodig' → escalate", async () => {
    const a = await analyseProviderResponse(
      "We hebben meer informatie nodig over uw situatie. Uw zaak is nu in behandeling.",
    );
    expect(a.tone).toBe("stalling");
    expect(a.action).toBe("escalate");
    expect(a.offers).toBe(false);
  });

  it("too-short reply is gracefully handled", async () => {
    const a = await analyseProviderResponse("ok");
    expect(a.action).toBe("counter");
    expect(a.reasoning).toMatch(/kort/i);
  });
});
