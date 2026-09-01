import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Borgt de eerlijkheids-semantiek van de admin-seed-tool: mislukte échte
 * pogingen zijn invoerbaar (voor een geloofwaardig slagingspercentage),
 * maar tellen nooit mee in het bespaarde totaal — en de ADMIN_SEEDED-
 * transparantie-marker blijft op beide uitkomsten staan.
 */

const route = readFileSync(
  path.join(__dirname, "../app/api/admin/seed-success/route.ts"),
  "utf8",
);
const form = readFileSync(
  path.join(__dirname, "../app/admin/seed-success/SeedSuccessForm.tsx"),
  "utf8",
);

describe("admin seed — uitkomst-invoer (gelukt/mislukt)", () => {
  it("route accepteert outcome SUCCESS|FAILED met SUCCESS als default", () => {
    expect(route).toMatch(/outcome:\s*z\.enum\(\["SUCCESS", "FAILED"\]\)\.default\("SUCCESS"\)/);
  });

  it("FAILED schrijft géén actualSavings — telt in de rate, niet in het totaal", () => {
    expect(route).toMatch(/actualSavingsCents:\s*outcome === "SUCCESS" \? yearlySaving : null/);
  });

  it("state komt uit de outcome (geen hardcoded SUCCESS meer)", () => {
    expect(route).toMatch(/state:\s*outcome/);
    expect(route).not.toMatch(/state:\s*"SUCCESS"/);
  });

  it("ADMIN_SEEDED-marker blijft op bill én negotiation staan", () => {
    expect(route).toMatch(/rawOcr:\s*"ADMIN_SEEDED"/);
    expect(route).toMatch(/ADMIN_SEEDED — \$\{customerYears\}j klant/);
  });

  it("formulier biedt de mislukt-optie expliciet aan en stuurt outcome mee", () => {
    expect(form).toMatch(/value="FAILED"/);
    expect(form).toMatch(/outcome,/);
  });

  it("geen hardcoded slagingspercentage op /proof — rate blijft berekend", () => {
    const proof = readFileSync(path.join(__dirname, "../app/proof/page.tsx"), "utf8");
    expect(proof).toMatch(/successRate = totalAttempts > 0 \? successful\.length \/ totalAttempts : 0/);
    expect(proof).not.toMatch(/successRate\s*=\s*0\.\d+;/);
  });
});
