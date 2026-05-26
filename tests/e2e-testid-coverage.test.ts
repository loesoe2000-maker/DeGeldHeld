/**
 * tests/e2e-testid-coverage.test.ts — v34 ASSURANCE DEEL 6.
 *
 * Source-leest de V31-check-client-files en assert dat:
 *   (a) ÉLKE <button type="submit"> een data-testid heeft
 *   (b) ÉLKE invul-input (number/text/email/file) een data-testid heeft
 *
 * Voorkomt regressies waar de V31 e2e-suite (tests/e2e/journey-v31-all-checks
 * + tests/e2e/journey-v34-coverage) breekt door selector-drift — bv. iemand
 * verwijdert per ongeluk de `data-testid="box3-submit"` en de e2e-suite
 * faalt pas in CI/CD, niet bij PR-tijd. Deze unit-test treft het direct.
 *
 * Geen browser, geen DOM — file-IO + regex op JSX-source. Snel, deterministisch.
 *
 * Bewuste scope:
 *   - 4 V31 check-clients (Geld/Box3/NS/Zorgkosten)
 *   - 1 Box3 proof-upload client (PDF-upload = security-relevant)
 *
 * Andere client-files (Hero/onderhandel/etc.) hebben andere testid-conventies
 * en zijn al door bestaande Hero-tests gedekt. Hier focus op de V31-surface.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

const CRITICAL_CLIENT_FILES = [
  "app/geld-check/GeldCheckClient.tsx",
  "app/box3-check/Box3CheckClient.tsx",
  "app/ns-check/NsCheckClient.tsx",
  "app/zorgkosten-check/ZorgkostenCheckClient.tsx",
  "app/box3-check/proof/[claimId]/Box3ProofUpload.tsx",
];

/**
 * Vind alle JSX-element-headers van een gegeven tagname in source. Geeft
 * voor elk element de COMPLETE opening-tag-string terug (van `<tag` tot de
 * eerste `>` die niet binnen een attribute-value zit).
 *
 * Niet 100% AST-correct, wel goed genoeg voor onze JSX-conventies (geen
 * gegooi met `>` in attribute-values bij deze 5 files — verified by inspecting
 * source). Houdt rekening met multi-line attributen.
 */
function findOpeningTags(source: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    let depth = 0;
    let i = m.index + tag.length + 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBraces = 0;
    while (i < source.length) {
      const ch = source[i];
      if (!inSingleQuote && !inDoubleQuote && inBraces === 0) {
        if (ch === ">") break;
      }
      if (ch === '"' && !inSingleQuote && inBraces === 0) inDoubleQuote = !inDoubleQuote;
      else if (ch === "'" && !inDoubleQuote && inBraces === 0) inSingleQuote = !inSingleQuote;
      else if (ch === "{" && !inSingleQuote && !inDoubleQuote) inBraces++;
      else if (ch === "}" && !inSingleQuote && !inDoubleQuote && inBraces > 0) inBraces--;
      i++;
    }
    if (i < source.length) {
      out.push(source.slice(m.index, i + 1));
    }
    void depth;
  }
  return out;
}

/** Check of opening-tag-string een gegeven attribuut-waarde-match heeft. */
function hasAttr(tag: string, attr: string, valueRegex: RegExp): boolean {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(["'\`])([^"'\`]*?)\\1`);
  const m = re.exec(tag);
  if (!m) return false;
  return valueRegex.test(m[2]);
}

/**
 * Snelle "data-testid"-presence — match elke vorm:
 *   data-testid="foo"           (string-literal)
 *   data-testid='foo'           (single-quote)
 *   data-testid={`box3-${id}`}  (template-literal in braces — dynamische ids)
 *   data-testid={variabele}     (variable in braces)
 */
function hasTestId(tag: string): boolean {
  if (/\bdata-testid\s*=\s*["'`][^"'`]+["'`]/.test(tag)) return true;
  if (/\bdata-testid\s*=\s*\{[^}]+\}/.test(tag)) return true;
  return false;
}

describe("v34 testid-coverage — élke critical client heeft testids op submit + inputs", () => {
  for (const rel of CRITICAL_CLIENT_FILES) {
    const path = resolve(ROOT, rel);

    it(`${rel}: élke <button type="submit"> heeft een data-testid`, () => {
      const src = readFileSync(path, "utf8");
      const buttons = findOpeningTags(src, "button");
      const submitButtons = buttons.filter((t) => hasAttr(t, "type", /^submit$/));
      expect(
        submitButtons.length,
        `geen <button type="submit"> gevonden in ${rel} — verwacht ≥ 1`,
      ).toBeGreaterThan(0);
      for (const tag of submitButtons) {
        expect(
          hasTestId(tag),
          `submit-knop zonder data-testid in ${rel}\n  tag: ${tag.slice(0, 120)}…`,
        ).toBe(true);
      }
    });

    it(`${rel}: gevoelige <input type=...> hebben een data-testid`, () => {
      const src = readFileSync(path, "utf8");
      const inputs = findOpeningTags(src, "input");
      // Gevoelige types: alle invulvelden die in de e2e-suite zouden worden
      // ge-fill'd. checkbox/radio/hidden zijn UI-state en kunnen testid-loos.
      const sensitive = inputs.filter((t) =>
        hasAttr(t, "type", /^(number|text|email|file|tel|search|date|password)$/),
      );
      if (sensitive.length === 0) return; // sommige files (proof-upload) hebben maar 1 file-input — dat is ok
      const without = sensitive.filter((t) => !hasTestId(t));
      expect(
        without,
        `inputs zonder data-testid in ${rel}:\n${without.map((t) => "  " + t.slice(0, 100) + "…").join("\n")}`,
      ).toHaveLength(0);
    });
  }

  it("alle critical client files bestaan + zijn niet leeg", () => {
    for (const rel of CRITICAL_CLIENT_FILES) {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      expect(src.length, `${rel} is leeg of ontbreekt`).toBeGreaterThan(500);
      // Cliënt-conventie: "use client"-directive op regel 1 of in de eerste 200 chars.
      expect(src.slice(0, 200)).toMatch(/"use client"/);
    }
  });
});

describe("v34 testid-coverage — drift-detectie tegen V31/V34 e2e-suite-selectors", () => {
  // Hard list van testids die de e2e-suite gebruikt. Source-find ze in de
  // app/-tree zodat hernoemen direct deze test breekt — VÓÓR de e2e-suite faalt.
  const REQUIRED_TESTIDS = [
    // V31 journey
    "geld-check-submit",
    "box3-jaar",
    "box3-submit",
    "box3-ncnp-card",
    "box3-diy-only-card",
    "ns-submit",
    "ns-results",
    "zorg-submit",
    "zorg-results",
    "zorg-checklist",
    // V34 coverage uitbreiding
    "box3-bank",
    "box3-overig",
    "box3-schulden",
    "box3-werkelijk",
    "ns-ticket",
    "ns-delay",
    "box3-ncnp-error",
  ];

  it("élke required testid komt voor in de critical-client-files", () => {
    const allSrc = CRITICAL_CLIENT_FILES.map((rel) =>
      readFileSync(resolve(ROOT, rel), "utf8"),
    ).join("\n\n");
    const missing: string[] = [];
    for (const id of REQUIRED_TESTIDS) {
      // testid kan in JSX als string OF in een {variabele} staan, dus
      // we zoeken zowel "id" als 'id' als `id`.
      const re = new RegExp(`data-testid\\s*=\\s*["'\`]${id}["'\`]`);
      if (!re.test(allSrc)) missing.push(id);
    }
    expect(
      missing,
      `e2e-suite verwacht deze testids maar ze ontbreken in de source:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });
});
