import { describe, it, expect } from "vitest";
import { parseNlEur, suggestUitspraakBedrag } from "@/lib/uitspraak-bedrag";

/**
 * v37 — bedrag-suggestie uit uitspraak/afrekening. Pure parser; geen Groq/IO.
 * Kernprincipe: een SUGGESTIE met confidence, nooit bindend.
 */

describe("parseNlEur", () => {
  it("1.234,56 → 123456 cent", () => {
    expect(parseNlEur("1.234,56")).toBe(123456);
  });
  it("150,00 → 15000 cent", () => {
    expect(parseNlEur("150,00")).toBe(15000);
  });
  it("zonder decimalen: 200 → 20000 cent", () => {
    expect(parseNlEur("200")).toBe(20000);
  });
  it("nul of negatief → null", () => {
    expect(parseNlEur("0,00")).toBeNull();
    expect(parseNlEur("abc")).toBeNull();
  });
});

describe("suggestUitspraakBedrag — high confidence (trefwoord-context)", () => {
  it("'terug te betalen € 175,00' → high, 17500", () => {
    const r = suggestUitspraakBedrag(
      "De verhuurder dient een bedrag terug te betalen van € 175,00 aan huurder.",
    );
    expect(r).not.toBeNull();
    expect(r?.cents).toBe(17500);
    expect(r?.confidence).toBe("high");
    expect(r?.context).toMatch(/terug te betalen/i);
  });

  it("'te veel in rekening gebracht € 1.240,00' → high, 124000", () => {
    const r = suggestUitspraakBedrag(
      "Conclusie: er is te veel in rekening gebracht, namelijk € 1.240,00.",
    );
    expect(r?.cents).toBe(124000);
    expect(r?.confidence).toBe("high");
  });

  it("energie: 'te verrekenen tegoed van € 87,50' → high, 8750", () => {
    const r = suggestUitspraakBedrag(
      "De leverancier erkent een te verrekenen tegoed van € 87,50.",
    );
    expect(r?.cents).toBe(8750);
    expect(r?.confidence).toBe("high");
  });

  it("'vastgesteld op € 320,00' → high", () => {
    const r = suggestUitspraakBedrag("Het restitutiebedrag is vastgesteld op € 320,00.");
    expect(r?.cents).toBe(32000);
    expect(r?.confidence).toBe("high");
  });
});

describe("suggestUitspraakBedrag — low confidence (geen trefwoord)", () => {
  it("losse bedragen zonder restitutie-woord → grootste, low", () => {
    const r = suggestUitspraakBedrag(
      "Servicekosten € 50,00. Administratie € 12,00. Totaal genoemd € 410,00 ergens.",
    );
    expect(r?.confidence).toBe("low");
    expect(r?.cents).toBe(41000); // grootste losse bedrag
  });

  it("leeg/onbruikbaar → null", () => {
    expect(suggestUitspraakBedrag("")).toBeNull();
    expect(suggestUitspraakBedrag("geen enkel bedrag hier")).toBeNull();
  });
});

describe("suggestUitspraakBedrag — high wint van losse bedragen", () => {
  it("kiest het trefwoord-bedrag, niet het grootste losse bedrag", () => {
    const r = suggestUitspraakBedrag(
      "Totale jaarkosten € 2.000,00. De verhuurder moet terug te betalen € 145,00.",
    );
    // 145 (high, trefwoord) wint van 2000 (low, los) — context > grootte.
    expect(r?.cents).toBe(14500);
    expect(r?.confidence).toBe("high");
  });
});
