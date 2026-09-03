import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fallbackAnalysis, actionToState } from "@/lib/rounds";

/**
 * v39 — acceptatie-detectie + de blocker-fix eromheen.
 *
 * Incident 1 sept 2026: "Jaa ze hebben het succesvol verlaagd" werd door de
 * heuristiek als stalling/counter behandeld. De fix daarvoor (ACCEPT_RE) had
 * in de eerste versie false positives op ticket-/opzegbevestigingen, en de
 * route sloot onderhandelingen automatisch af op de classificatie. Elke test
 * hieronder verankert een van die drie lessen.
 */

describe("fallbackAnalysis — acceptatie-detectie", () => {
  it("herkent bedrag-loze acceptatie: 'Jaa ze hebben het succesvol verlaagd'", () => {
    const r = fallbackAnalysis("Jaa ze hebben het succesvol verlaagd");
    expect(r.action).toBe("accept");
    expect(r.offers).toBe(true);
    expect(r.offeredCents).toBeNull();
  });

  it("herkent kale korte bevestigingen ('Gelukt!', 'Akkoord.')", () => {
    expect(fallbackAnalysis("Gelukt!").action).toBe("accept");
    expect(fallbackAnalysis("Akkoord.").action).toBe("accept");
  });

  it("prijs-object + ambigu werkwoord = accept, mét bedrag-extractie", () => {
    const r = fallbackAnalysis("We hebben uw maandbedrag aangepast naar €25,00 per maand.");
    expect(r.action).toBe("accept");
    expect(r.offeredCents).toBe(2500);
  });

  it("ticket-bevestiging is GEEN accept ('Uw verzoek is verwerkt onder referentienummer …')", () => {
    const r = fallbackAnalysis(
      "Uw verzoek is verwerkt onder referentienummer 483929. U hoort binnen 5 werkdagen van ons.",
    );
    expect(r.action).not.toBe("accept");
  });

  it("opzegbevestiging is GEEN accept ('Uw opzegging is doorgevoerd per 1 oktober.')", () => {
    expect(fallbackAnalysis("Uw opzegging is doorgevoerd per 1 oktober.").action).not.toBe("accept");
  });

  it("ontkenning wint: 'We hebben het bedrag helaas niet verlaagd.'", () => {
    expect(fallbackAnalysis("We hebben het bedrag helaas niet verlaagd.").action).not.toBe("accept");
  });
});

describe("classificatie mag nooit auto-sluiten (blocker-fix v39)", () => {
  it("actionToState mapt accept/walk_away op RESPONSE_RECEIVED — gebruiker bevestigt via /uitkomst", () => {
    expect(actionToState("accept")).toBe("RESPONSE_RECEIVED");
    expect(actionToState("walk_away")).toBe("RESPONSE_RECEIVED");
    expect(actionToState("escalate")).toBe("RESPONSE_RECEIVED");
    expect(actionToState("counter")).toBe("COUNTER_SENT");
  });

  it("round-route zet nergens meer closedAt", () => {
    const route = readFileSync(
      path.join(__dirname, "../app/api/negotiations/round/route.ts"),
      "utf8",
    );
    expect(route).not.toMatch(/closedAt: new Date\(\)/);
  });

  it("uitkomst-pagina brickt niet meer op closedAt-zonder-bedrag", () => {
    const page = readFileSync(
      path.join(__dirname, "../app/onderhandel/[billId]/uitkomst/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/actualSavingsCents != null/);
    expect(page).not.toMatch(/closedAt != null \|\|/);
  });

  it("round-route analyseert geen OCR-foutmarkers als provider-tekst", () => {
    const route = readFileSync(
      path.join(__dirname, "../app/api/negotiations/round/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/OCR_\|PDF_\|HEIC_\|NORMALIZE_/);
  });
});
