import { describe, it, expect } from "vitest";
import {
  berekenKalibratie,
  PUNTEN_TOLERANTIE,
  GATE_A_MIN_CASES,
  type PilotCase,
} from "@/lib/pilot-kalibratie";

/**
 * v40 F4 — de gate mag alleen groen worden als de check aantoonbaar klopt.
 * De harde eis is NUL vals-positieven: iemand "kansrijk" noemen die het niet
 * is, is de enige fout die de klant geld kost.
 */

const c = (over: Partial<PilotCase> = {}): PilotCase => ({
  id: "c1",
  label: "testwoning",
  onzePunten: 150,
  onsVerdict: "kansrijk",
  onzeMaxHuurCents: 98_000,
  kaleHuurCents: 120_000,
  officieelPunten: 150,
  officieelMaxHuurCents: 98_000,
  uitspraakUitkomst: null,
  uitspraakPunten: null,
  ...over,
});

describe("pilot-kalibratie — gate A (lanceer-gate)", () => {
  it("leeg logboek → gate dicht, met een leesbare reden", () => {
    const r = berekenKalibratie([]);
    expect(r.gateA.gehaald).toBe(false);
    expect(r.gateA.redenen.join(" ")).toMatch(/3 van 3|Nog 3/);
    expect(r.gemiddeldAbsoluutVerschil).toBeNull();
  });

  it("drie exacte woningen → gate A groen", () => {
    const r = berekenKalibratie([
      c({ id: "a", label: "a" }),
      c({ id: "b", label: "b" }),
      c({ id: "c", label: "c" }),
    ]);
    expect(r.aantalMetOfficieel).toBe(3);
    expect(r.gemiddeldAbsoluutVerschil).toBe(0);
    expect(r.gateA.gehaald).toBe(true);
    expect(r.gateA.redenen).toEqual([]);
  });

  it("afwijking binnen de tolerantie blokkeert niet", () => {
    const r = berekenKalibratie([
      c({ id: "a", label: "a", onzePunten: 152 }), // +2
      c({ id: "b", label: "b", onzePunten: 148 }), // −2
      c({ id: "c", label: "c" }),
    ]);
    expect(r.binnenTolerantie).toBe(3);
    expect(r.gateA.gehaald).toBe(true);
  });

  it("één woning buiten de tolerantie blokkeert de hele gate", () => {
    const r = berekenKalibratie([
      c({ id: "a", label: "scheve woning", onzePunten: 158 }), // +8
      c({ id: "b", label: "b" }),
      c({ id: "c", label: "c" }),
    ]);
    expect(r.gateA.gehaald).toBe(false);
    expect(r.gateA.redenen.join(" ")).toMatch(/scheve woning.*8 punten/);
    expect(r.grootsteAfwijking?.verschil).toBe(8);
  });

  it("VALS POSITIEF blokkeert altijd, ook bij perfecte punten", () => {
    const r = berekenKalibratie([
      // Punten kloppen exact, maar de huur zit ónder het officiële maximum
      // terwijl wij "kansrijk" zeiden — dat is precies de fout die niet mag.
      c({ id: "a", label: "fout advies", kaleHuurCents: 90_000 }),
      c({ id: "b", label: "b" }),
      c({ id: "c", label: "c" }),
    ]);
    expect(r.valsPositieven).toHaveLength(1);
    expect(r.gateA.gehaald).toBe(false);
    expect(r.gateA.redenen.join(" ")).toMatch(/VALS POSITIEF/);
  });

  it("'geen_zaak' met een lage huur is GEEN vals positief", () => {
    const r = berekenKalibratie([
      c({ id: "a", label: "a", onsVerdict: "geen_zaak", kaleHuurCents: 90_000 }),
      c({ id: "b", label: "b" }),
      c({ id: "c", label: "c" }),
    ]);
    expect(r.valsPositieven).toEqual([]);
    expect(r.gateA.gehaald).toBe(true);
  });

  it("cases zonder officiële check tellen niet mee voor gate A", () => {
    const r = berekenKalibratie([
      c({ id: "a", label: "a", officieelPunten: null, officieelMaxHuurCents: null }),
      c({ id: "b", label: "b" }),
    ]);
    expect(r.aantalCases).toBe(2);
    expect(r.aantalMetOfficieel).toBe(1);
    expect(r.gateA.gehaald).toBe(false);
  });
});

describe("pilot-kalibratie — gate B (doorlopend, na lancering)", () => {
  it("blokkeert de lancering niet: gate A kan groen zijn terwijl B nog loopt", () => {
    const r = berekenKalibratie([
      c({ id: "a", label: "a" }),
      c({ id: "b", label: "b" }),
      c({ id: "c", label: "c" }),
    ]);
    expect(r.gateA.gehaald).toBe(true);
    expect(r.gateB.gehaald).toBe(false);
    expect(r.gateB.redenen.join(" ")).toMatch(/4 tot 6 maanden/);
  });

  it("een verloren zaak na 'kansrijk' is een vals positief in beide gates", () => {
    const r = berekenKalibratie([
      c({ id: "a", label: "verloren zaak", uitspraakUitkomst: "VERLOREN" }),
      c({ id: "b", label: "b" }),
      c({ id: "c", label: "c" }),
    ]);
    expect(r.valsPositieven.some((v) => v.label === "verloren zaak")).toBe(true);
    expect(r.gateA.gehaald).toBe(false);
    expect(r.gateB.gehaald).toBe(false);
  });

  it("LOPEND telt niet als uitspraak", () => {
    const r = berekenKalibratie([c({ uitspraakUitkomst: "LOPEND" })]);
    expect(r.aantalMetUitspraak).toBe(0);
  });

  it("vijf gewonnen zaken → gate B groen", () => {
    const cases = [1, 2, 3, 4, 5].map((i) =>
      c({ id: `w${i}`, label: `w${i}`, uitspraakUitkomst: "GEWONNEN" }),
    );
    const r = berekenKalibratie(cases);
    expect(r.aantalMetUitspraak).toBe(5);
    expect(r.gateB.gehaald).toBe(true);
  });
});

describe("pilot-kalibratie — drempels zijn bewuste productkeuzes", () => {
  it("tolerantie is 2 punten en het minimum voor gate A is 3 woningen", () => {
    expect(PUNTEN_TOLERANTIE).toBe(2);
    expect(GATE_A_MIN_CASES).toBe(3);
  });
});
