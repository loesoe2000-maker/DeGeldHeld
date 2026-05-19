/**
 * v16 DEEL 7 — Stap 7: multi-round response analysis + counter-mail.
 *
 * The /onderhandel/[billId]/ronde/[n] page is auth-gated and needs a
 * real Negotiation row. The journey-test exercises analyseProviderResponse
 * directly (no Groq call needed — the heuristic fallback covers the
 * three response types when no API key is set) and verifies the route
 * is reachable + behaves safely against bogus IDs.
 *
 * Contracts validated:
 *   - Constructive reply with a € amount → action=counter, offers=true,
 *     offeredCents matches the parsed amount.
 *   - Rejecting reply → action=walk_away, tone=afwijzend.
 *   - Stalling reply → action=escalate or counter, tone=stalling.
 *   - /onderhandel/<id>/ronde/1 with a bogus id never 500s.
 *   - POST /api/negotiations/round without auth → 401, never 500.
 */
import { test, expect } from "@playwright/test";
import { analyseProviderResponse, __setSleepImpl } from "@/lib/rounds";

// Make the retry-loop sleep a no-op so tests are fast.
__setSleepImpl(async () => {});

test.describe("v16 journey-7 — counter-mail 3 response types", () => {
  test("constructief reply with €25 offer → action=counter or accept, offeredCents=2500", async () => {
    const reply = `Geachte mevrouw,
Na overleg kunnen we u een nieuw maandtarief aanbieden van €25,00.
We hopen dat u tevreden bent met dit voorstel.
Met vriendelijke groet, KPN klantbehoud`;
    const a = await analyseProviderResponse(reply);
    expect(["counter", "accept"]).toContain(a.action);
    expect(a.offeredCents).toBe(2500);
    expect(["constructief", "stalling"]).toContain(a.tone);
  });

  test("afwijzend reply → action=walk_away, tone=afwijzend, offers=false", async () => {
    const reply =
      "Helaas hebben we momenteel geen mogelijkheid om uw tarief verder te verlagen. Onze prijzen zijn al scherp.";
    const a = await analyseProviderResponse(reply);
    expect(a.action).toBe("walk_away");
    expect(a.tone).toBe("afwijzend");
    expect(a.offers).toBe(false);
  });

  test("stalling reply → action=escalate, tone=stalling", async () => {
    const reply =
      "We hebben meer informatie nodig over uw situatie. Uw zaak is nu in behandeling.";
    const a = await analyseProviderResponse(reply);
    expect(a.tone).toBe("stalling");
    expect(a.action).toBe("escalate");
    expect(a.offers).toBe(false);
  });

  test("German rejecting reply works (multi-language regex)", async () => {
    const reply =
      "Leider können wir Ihren Tarif nicht weiter reduzieren — unsere Preise sind nicht verhandelbar.";
    const a = await analyseProviderResponse(reply);
    expect(a.action).toBe("walk_away");
  });

  test("English constructive reply parses the amount", async () => {
    const reply = "After review we can offer you a reduced rate of €22.50 per month.";
    const a = await analyseProviderResponse(reply);
    expect(a.offeredCents).toBe(2250);
    expect(["counter", "accept"]).toContain(a.action);
  });

  test("tiny reply → too-short fallback", async () => {
    const a = await analyseProviderResponse("ok");
    expect(a.action).toBe("counter");
    expect(a.reasoning).toMatch(/kort/i);
  });

  test("GET /onderhandel/<bogus>/ronde/1 never 500s", async ({ request }) => {
    const r = await request.get("/onderhandel/bogus_id/ronde/1", {
      maxRedirects: 0,
    });
    expect(r.status()).toBeLessThan(500);
  });

  test("POST /api/negotiations/round without auth → 401", async ({ request }) => {
    const r = await request.post("/api/negotiations/round", {
      data: { negotiationId: "x", providerResponse: "test" },
    });
    // 401 (no session) or 400 (missing fields) — both are "not 500".
    expect([400, 401]).toContain(r.status());
  });

  test("AWAITING_USER_CONFIRM gate is wired (auto-pingpong invariant)", () => {
    // Source-level contract — the inbound-router must never set the
    // outcome to ACCEPTED on incoming counters; only the user-confirm
    // endpoint can do that.
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const ROOT = resolve(__dirname, "../..");
    const src = readFileSync(resolve(ROOT, "lib/inbound-router.ts"), "utf8");
    expect(src).toMatch(/AWAITING_USER_CONFIRM/);
    expect(src).not.toMatch(/outcome:\s*"ACCEPTED"/);
  });
});
