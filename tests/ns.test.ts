import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  nsCompensation,
  nsClaimBrief,
  NS,
  NS_PEILDATUM,
  NS_VERIFIED_AT,
  type NsInput,
} from "@/lib/ns";
import { PLUS_PILLARS } from "@/lib/plus";

/**
 * v29 DEEL 2 — NS Geld-Terug bij Vertraging. Percentages + drempels + minimum-
 * claim + deadline EXACT uit docs/V29_DATA_2026.md (NS-voorwaarden + EU-PRR).
 */

describe("nsCompensation — binnenland (losse ticket, NS-NL regime)", () => {
  it("< 30 min → geen compensatie", () => {
    const r = nsCompensation({ ticketCents: 1250, delayMinutes: 29 });
    expect(r.eligible).toBe(false);
    expect(r.regime).toBe("NONE");
    expect(r.compensationCents).toBe(0);
  });

  it("30-59 min → 50% binnen NS-NL", () => {
    const r = nsCompensation({ ticketCents: 1250, delayMinutes: 30 });
    expect(r.eligible).toBe(true);
    expect(r.regime).toBe("NS_NL");
    expect(r.percentage).toBe(50);
    expect(r.compensationCents).toBe(625);
  });

  it("≥ 60 min → 100% binnen NS-NL", () => {
    const r = nsCompensation({ ticketCents: 1250, delayMinutes: 60 });
    expect(r.eligible).toBe(true);
    expect(r.regime).toBe("NS_NL");
    expect(r.percentage).toBe(100);
    expect(r.compensationCents).toBe(1250);
  });

  it("Lange vertraging op een laag ticket → onder minimum-claim € 2,30", () => {
    // 50% × € 4,00 = € 2,00 → onder minimum
    const r = nsCompensation({ ticketCents: 400, delayMinutes: 30 });
    expect(r.belowMinimum).toBe(true);
    expect(r.eligible).toBe(false);
    expect(r.reden).toMatch(/minimum-claim|€ 2,30/i);
  });
});

describe("nsCompensation — EU-PRR (internationaal)", () => {
  it("< 60 min → geen compensatie EU-PRR", () => {
    const r = nsCompensation({ ticketCents: 5000, delayMinutes: 45, isInternational: true });
    expect(r.eligible).toBe(false);
    expect(r.regime).toBe("NONE");
  });

  it("60-119 min → 25% EU-PRR", () => {
    const r = nsCompensation({ ticketCents: 8000, delayMinutes: 90, isInternational: true });
    expect(r.regime).toBe("EU_PRR");
    expect(r.percentage).toBe(25);
    expect(r.compensationCents).toBe(2000);
  });

  it("≥ 120 min → 50% EU-PRR", () => {
    const r = nsCompensation({ ticketCents: 8000, delayMinutes: 120, isInternational: true });
    expect(r.regime).toBe("EU_PRR");
    expect(r.percentage).toBe(50);
    expect(r.compensationCents).toBe(4000);
  });
});

describe("nsCompensation — abonnement (kortings-/toeslag)", () => {
  it("15-29 min → 50% (abonnement-drempel lager dan binnenland-losse-ticket)", () => {
    const r = nsCompensation({ ticketCents: 1000, delayMinutes: 15, isAbonnement: true });
    expect(r.regime).toBe("ABONNEMENT");
    expect(r.percentage).toBe(50);
  });

  it("≥ 30 min → 100% abonnement", () => {
    const r = nsCompensation({ ticketCents: 1000, delayMinutes: 30, isAbonnement: true });
    expect(r.regime).toBe("ABONNEMENT");
    expect(r.percentage).toBe(100);
  });

  it("< 15 min → geen compensatie abonnement", () => {
    const r = nsCompensation({ ticketCents: 1000, delayMinutes: 14, isAbonnement: true });
    expect(r.regime).toBe("NONE");
  });
});

describe("nsCompensation — Vrij/Flex (geen bedragen verzinnen)", () => {
  it("≥ 15 min vertraging → ABONNEMENT_VERWIJS + bedrag 0 (zie Mijn NS)", () => {
    const r = nsCompensation({ ticketCents: 1000, delayMinutes: 30, isVrijOfFlex: true });
    expect(r.regime).toBe("ABONNEMENT_VERWIJS");
    expect(r.compensationCents).toBe(0);
    expect(r.reden).toMatch(/Mijn NS/i);
    expect(r.eligible).toBe(true);
  });

  it("< 15 min Vrij/Flex → geen compensatie", () => {
    const r = nsCompensation({ ticketCents: 1000, delayMinutes: 10, isVrijOfFlex: true });
    expect(r.eligible).toBe(false);
    expect(r.regime).toBe("ABONNEMENT_VERWIJS");
  });
});

describe("nsCompensation — edge cases", () => {
  it("negatieve / NaN ticket → NONE met uitleg", () => {
    expect(nsCompensation({ ticketCents: -100, delayMinutes: 30 }).regime).toBe("NONE");
    expect(nsCompensation({ ticketCents: NaN, delayMinutes: 30 }).regime).toBe("NONE");
  });

  it("negatieve / NaN vertraging → NONE met uitleg", () => {
    expect(nsCompensation({ ticketCents: 1000, delayMinutes: -1 }).regime).toBe("NONE");
    expect(nsCompensation({ ticketCents: 1000, delayMinutes: NaN }).regime).toBe("NONE");
  });
});

describe("constants — peildatum + sourced waarden", () => {
  it("peildatum/verifiedAt staan op 2026-stempels", () => {
    expect(NS_PEILDATUM).toBe("2026-01-01");
    expect(NS_VERIFIED_AT).toBe("2026-05-24");
  });

  it("percentages + minimum-claim kloppen met V29_DATA_2026.md", () => {
    expect(NS.binnenland.short.pct).toBe(50);
    expect(NS.binnenland.long.pct).toBe(100);
    expect(NS.euPrr.short.pct).toBe(25);
    expect(NS.euPrr.long.pct).toBe(50);
    expect(NS.abonnement.short.pct).toBe(50);
    expect(NS.abonnement.long.pct).toBe(100);
    expect(NS.minClaimCents).toBe(230);
    expect(NS.deadlineDagen).toBe(30);
  });
});

describe("nsClaimBrief", () => {
  it("noemt het percentage en de berekende compensatie in de brief", () => {
    const input: NsInput = { ticketCents: 1250, delayMinutes: 60 };
    const r = nsCompensation(input);
    const tekst = nsClaimBrief(input, r, { dateISO: "2026-04-12", route: "Amsterdam → Utrecht" });
    expect(tekst).toContain("Amsterdam → Utrecht");
    expect(tekst).toContain("60 minuten");
    expect(tekst).toContain("100%");
    expect(tekst).toMatch(/€\s?12,50/);
  });

  it("bij Vrij/Flex verwijst de brief naar Mijn NS i.p.v. een bedrag", () => {
    const input: NsInput = { ticketCents: 0, delayMinutes: 45, isVrijOfFlex: true };
    const r = nsCompensation(input);
    const tekst = nsClaimBrief(input, r);
    expect(tekst).toMatch(/Vrij-\/Flex|Mijn NS/);
  });
});

describe("Plus auto-claim pijler (DEEL 2c — positionering)", () => {
  it("Plus heeft een 'nsclaim'-pijler met NS-tekst", () => {
    const ids = PLUS_PILLARS.map((p) => p.id);
    expect(ids).toContain("nsclaim");
    const ns = PLUS_PILLARS.find((p) => p.id === "nsclaim")!;
    expect(ns.title).toMatch(/NS|trein/i);
    expect(ns.body).toMatch(/Mijn NS|deadline/i);
  });
});

describe("anti-hallucinatie — élke NS-constante is gesourcet", () => {
  const src = readFileSync(resolve(__dirname, "..", "lib/ns.ts"), "utf8");
  it("bronnen voor NS en EU-PRR aanwezig", () => {
    // bron-comment + URL kunnen op één of twee regels staan; we eisen alleen
    // dat élke domein als bron in het bestand voorkomt.
    expect(src).toMatch(/ns\.nl/);
    expect(src).toMatch(/eur-lex\.europa\.eu/i);
    expect(src).toMatch(/bron:/);
  });
});
