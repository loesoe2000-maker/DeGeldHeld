import { describe, it, expect } from "vitest";
import {
  decideClaimNudge,
  formatClaimNudge,
  INTENT_STIL_DAGEN,
  type ClaimForNudge,
} from "@/lib/claim-deadlines";

/**
 * v37 — pure deadline-nudge-beslissing. Geen DB/mail.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-01T06:00:00Z");
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function huur(over: Partial<ClaimForNudge> = {}): ClaimForNudge {
  return {
    id: "h1",
    soort: "huur",
    status: "INTENT",
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0),
    lastNudgeKind: null,
    ...over,
  };
}
function energie(over: Partial<ClaimForNudge> = {}): ClaimForNudge {
  return { ...huur(), id: "e1", soort: "energie", ...over };
}

describe("decideClaimNudge — INTENT stil", () => {
  it("vers (0 dagen) → geen nudge", () => {
    expect(decideClaimNudge(huur({ createdAt: daysAgo(0) }), NOW)).toBeNull();
  });
  it(`${INTENT_STIL_DAGEN}+ dagen stil → intent-stil`, () => {
    expect(decideClaimNudge(huur({ createdAt: daysAgo(8) }), NOW)).toBe("intent-stil");
  });
  it("al genudged → niet opnieuw", () => {
    expect(
      decideClaimNudge(huur({ createdAt: daysAgo(20), lastNudgeKind: "intent-stil" }), NOW),
    ).toBeNull();
  });
});

describe("decideClaimNudge — reactie verlopen (huur 21d, energie 30d)", () => {
  it("huur: 20 dagen na versturen → nog niet", () => {
    expect(
      decideClaimNudge(huur({ status: "BEZWAAR_GESTUURD", updatedAt: daysAgo(20) }), NOW),
    ).toBeNull();
  });
  it("huur: 21+ dagen → reactie-verlopen", () => {
    expect(
      decideClaimNudge(huur({ status: "BEZWAAR_GESTUURD", updatedAt: daysAgo(22) }), NOW),
    ).toBe("reactie-verlopen");
  });
  it("energie: 25 dagen → nog niet (termijn is 30)", () => {
    expect(
      decideClaimNudge(energie({ status: "KLACHT_GESTUURD", updatedAt: daysAgo(25) }), NOW),
    ).toBeNull();
  });
  it("energie: 31 dagen → reactie-verlopen", () => {
    expect(
      decideClaimNudge(energie({ status: "KLACHT_GESTUURD", updatedAt: daysAgo(31) }), NOW),
    ).toBe("reactie-verlopen");
  });
  it("al genudged → niet opnieuw", () => {
    expect(
      decideClaimNudge(
        huur({ status: "BEZWAAR_GESTUURD", updatedAt: daysAgo(40), lastNudgeKind: "reactie-verlopen" }),
        NOW,
      ),
    ).toBeNull();
  });
});

describe("decideClaimNudge — behandeling traag (huur 5mnd, energie 3mnd)", () => {
  it("huur: 4 maanden → nog niet", () => {
    expect(
      decideClaimNudge(huur({ status: "HUURCOMMISSIE_INGEDIEND", updatedAt: daysAgo(120) }), NOW),
    ).toBeNull();
  });
  it("huur: 5+ maanden → behandeling-traag", () => {
    expect(
      decideClaimNudge(huur({ status: "HUURCOMMISSIE_INGEDIEND", updatedAt: daysAgo(160) }), NOW),
    ).toBe("behandeling-traag");
  });
  it("energie: 100 dagen (>3mnd) → behandeling-traag", () => {
    expect(
      decideClaimNudge(
        energie({ status: "GESCHILLENCOMMISSIE_INGEDIEND", updatedAt: daysAgo(100) }),
        NOW,
      ),
    ).toBe("behandeling-traag");
  });
});

describe("decideClaimNudge — terminale/uitspraak status → nooit", () => {
  for (const status of ["UITSPRAAK", "CHARGED", "FAILED"]) {
    it(`${status} → geen nudge`, () => {
      expect(decideClaimNudge(huur({ status, updatedAt: daysAgo(999) }), NOW)).toBeNull();
    });
  }
});

describe("formatClaimNudge", () => {
  it("intent-stil noemt 'verstuur' + de juiste wederpartij", () => {
    const m = formatClaimNudge("intent-stil", "huur", "h1");
    expect(m.subject).toMatch(/verstuur/i);
    expect(m.text).toMatch(/verhuurder/);
    expect(m.text).toMatch(/account\/claims/);
  });
  it("reactie-verlopen energie → noemt Geschillencommissie + leverancier", () => {
    const m = formatClaimNudge("reactie-verlopen", "energie", "e1");
    expect(m.text).toMatch(/Geschillencommissie Energie/);
    expect(m.text).toMatch(/energieleverancier/);
  });
  it("behandeling-traag → vraagt om uitspraak te uploaden", () => {
    const m = formatClaimNudge("behandeling-traag", "huur", "h1");
    expect(m.text).toMatch(/uitspraak|upload/i);
  });
});
