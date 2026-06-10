import { describe, it, expect } from "vitest";
import {
  isVolmachtClaimType,
  volmachtMandateText,
  validateSignInput,
  VOLMACHT_TEMPLATE_VERSION,
  VOLMACHT_CLAIM_TYPES,
} from "@/lib/volmacht";
import { hashIp } from "@/lib/volmacht-server";
import { addMonths } from "@/lib/volmacht-pdf";

/**
 * v36 idee 2 — Pure tests voor de SES-volmacht helpers.
 */

describe("isVolmachtClaimType", () => {
  it("accepteert huur + energie", () => {
    expect(isVolmachtClaimType("HuurServicekostenClaim")).toBe(true);
    expect(isVolmachtClaimType("EnergieEindafrekeningClaim")).toBe(true);
  });
  it("weigert Box 3 — die vereist DigiD", () => {
    expect(isVolmachtClaimType("Box3Claim")).toBe(false);
  });
  it("weigert onzin", () => {
    expect(isVolmachtClaimType("")).toBe(false);
    expect(isVolmachtClaimType(null)).toBe(false);
    expect(isVolmachtClaimType(42)).toBe(false);
  });
});

describe("VOLMACHT_TEMPLATE_VERSION", () => {
  it("is een non-empty string (versioneerbaar)", () => {
    expect(typeof VOLMACHT_TEMPLATE_VERSION).toBe("string");
    expect(VOLMACHT_TEMPLATE_VERSION.length).toBeGreaterThan(0);
  });
});

describe("volmachtMandateText", () => {
  it("huur-template noemt huurder + Huurcommissie + KvK", () => {
    const t = volmachtMandateText("HuurServicekostenClaim", "Anna van Houten");
    expect(t).toMatch(/Anna van Houten/);
    expect(t).toMatch(/Huurcommissie/);
    expect(t).toMatch(/KvK 84079398/);
    expect(t).toMatch(/intrekken/i);
  });
  it("huur-template sluit nieuw huurcontract expliciet uit", () => {
    const t = volmachtMandateText("HuurServicekostenClaim", "Jan Jansen");
    expect(t).toMatch(/geen nieuw huurcontract/i);
  });
  it("energie-template noemt Geschillencommissie Energie", () => {
    const t = volmachtMandateText("EnergieEindafrekeningClaim", "Maria de Vries");
    expect(t).toMatch(/Geschillencommissie Energie/);
    expect(t).toMatch(/Maria de Vries/);
  });
  it("energie-template sluit leverancier-switch expliciet uit", () => {
    const t = volmachtMandateText("EnergieEindafrekeningClaim", "X Y");
    expect(t).toMatch(/geen nieuw energiecontract/i);
    expect(t).toMatch(/geen leverancier wijzigen/i);
  });
  it("templates verschillen tussen claim-types", () => {
    const huur = volmachtMandateText("HuurServicekostenClaim", "Jan Janssen");
    const energie = volmachtMandateText("EnergieEindafrekeningClaim", "Jan Janssen");
    expect(huur).not.toBe(energie);
  });
});

describe("validateSignInput", () => {
  function makeOk(over: Partial<Parameters<typeof validateSignInput>[0]> = {}) {
    const fullName = over.fullName ?? "Anna van Houten";
    const claimType = (over.claimType ?? "HuurServicekostenClaim") as
      | "HuurServicekostenClaim"
      | "EnergieEindafrekeningClaim";
    const acceptedText =
      over.acceptedText ?? volmachtMandateText(claimType, fullName);
    return validateSignInput({
      fullName,
      claimType,
      claimId: over.claimId ?? "claim_123",
      acceptedText,
    });
  }

  it("happy path → ok", () => {
    const r = makeOk();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fullName).toBe("Anna van Houten");
  });

  it("Box3 → afgewezen (geen SES voor Belastingdienst)", () => {
    const r = makeOk({ claimType: "Box3Claim" as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/claim-type/i);
  });

  it("ontbrekende claimId → afgewezen", () => {
    const r = makeOk({ claimId: "  " });
    expect(r.ok).toBe(false);
  });

  it("naam te kort → afgewezen", () => {
    const r = makeOk({
      fullName: "Jan",
      acceptedText: volmachtMandateText("HuurServicekostenClaim", "Jan"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/minstens 5/i);
  });

  it("naam zonder spatie → afgewezen ('voor + achternaam')", () => {
    const r = makeOk({
      fullName: "Jansen123",
      acceptedText: volmachtMandateText("HuurServicekostenClaim", "Jansen123"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/voor- én achternaam/i);
  });

  it("naam te lang → afgewezen", () => {
    const longName = "X".repeat(120) + " Y";
    const r = makeOk({
      fullName: longName,
      acceptedText: volmachtMandateText("HuurServicekostenClaim", longName),
    });
    expect(r.ok).toBe(false);
  });

  it("acceptedText mismatch → afgewezen (template-versie sync)", () => {
    const r = makeOk({ acceptedText: "andere tekst" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/komt niet overeen/i);
  });

  it("trim whitespace op acceptedText is OK", () => {
    const t = volmachtMandateText("HuurServicekostenClaim", "Anna van Houten");
    const r = validateSignInput({
      fullName: "Anna van Houten",
      claimType: "HuurServicekostenClaim",
      claimId: "claim_x",
      acceptedText: `   ${t}   `,
    });
    expect(r.ok).toBe(true);
  });
});

describe("hashIp", () => {
  it("zelfde input → zelfde output (deterministisch)", () => {
    const a = hashIp("1.2.3.4", "secret");
    const b = hashIp("1.2.3.4", "secret");
    expect(a).toBe(b);
  });
  it("verschillend secret → verschillend resultaat", () => {
    const a = hashIp("1.2.3.4", "secret-A");
    const b = hashIp("1.2.3.4", "secret-B");
    expect(a).not.toBe(b);
  });
  it("verschillend ip → verschillend resultaat", () => {
    const a = hashIp("1.2.3.4", "secret");
    const b = hashIp("5.6.7.8", "secret");
    expect(a).not.toBe(b);
  });
  it("output is 64 hex-chars (SHA-256)", () => {
    const h = hashIp("1.2.3.4", "secret");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("VOLMACHT_CLAIM_TYPES — exhaustive coverage", () => {
  it("alle claim-types hebben een werkende mandate-text", () => {
    for (const t of VOLMACHT_CLAIM_TYPES) {
      const text = volmachtMandateText(t, "Anna van Houten");
      expect(text.length).toBeGreaterThan(100);
      expect(text).toMatch(/Anna van Houten/);
    }
  });
});

// v37 cijfer-audit — de volmacht-einddatum (uitgifte + 12 mnd) moet ook op
// maand-randen juridisch kloppen. Kale setMonth overschiet bij korte
// doelmaanden; addMonths clamp't naar de laatste dag van de bedoelde maand.
describe("addMonths — einddatum-clamp op maand-randen", () => {
  it("29 feb 2024 (schrikkeljaar) + 12 mnd → 28 feb 2025 (niet 1 maart)", () => {
    const r = addMonths(new Date(2024, 1, 29), 12);
    expect([r.getFullYear(), r.getMonth(), r.getDate()]).toEqual([2025, 1, 28]);
  });

  it("31 jan 2026 + 1 mnd → 28 feb 2026 (niet 2/3 maart)", () => {
    const r = addMonths(new Date(2026, 0, 31), 1);
    expect([r.getFullYear(), r.getMonth(), r.getDate()]).toEqual([2026, 1, 28]);
  });

  it("31 jan 2024 + 1 mnd → 29 feb 2024 (schrikkeljaar houdt de 29e)", () => {
    const r = addMonths(new Date(2024, 0, 31), 1);
    expect([r.getFullYear(), r.getMonth(), r.getDate()]).toEqual([2024, 1, 29]);
  });

  it("31 aug 2026 + 1 mnd → 30 sep 2026", () => {
    const r = addMonths(new Date(2026, 7, 31), 1);
    expect([r.getFullYear(), r.getMonth(), r.getDate()]).toEqual([2026, 8, 30]);
  });

  it("gewone datum blijft exact: 15 jun 2026 + 12 mnd → 15 jun 2027", () => {
    const r = addMonths(new Date(2026, 5, 15), 12);
    expect([r.getFullYear(), r.getMonth(), r.getDate()]).toEqual([2027, 5, 15]);
  });
});
