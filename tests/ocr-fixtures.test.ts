import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extractBill } from "../lib/ocr";
import { extractPdfText } from "../lib/pdf_extract";

const FIX_DIR = path.resolve(__dirname, "fixtures/bills");

type Expected = {
  provider: string;
  monthlyCents: number;
  totalCents: number;
  category: string;
  country: string;
};

function loadFixtures(): Array<{ name: string; pdf: Buffer; expected: Expected }> {
  if (!fs.existsSync(FIX_DIR)) return [];
  const files = fs.readdirSync(FIX_DIR).filter((f) => f.endsWith(".pdf")).sort();
  return files.map((f) => {
    const slug = f.replace(/\.pdf$/, "");
    const pdf = fs.readFileSync(path.join(FIX_DIR, f));
    const expected = JSON.parse(
      fs.readFileSync(path.join(FIX_DIR, `${slug}.expected.json`), "utf-8"),
    ) as Expected;
    return { name: slug, pdf, expected };
  });
}

const hasLiveGroq = !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "gsk_test_dummy";

describe("ocr-fixtures: 30-bill validation suite", () => {
  const fixtures = loadFixtures();

  it("has 30 fixtures (auto-generated; regenerate with `npx tsx scripts/generate-ocr-fixtures.ts`)", () => {
    expect(fixtures.length).toBe(30);
  });

  it("every fixture parses as a PDF + has non-empty text content", async () => {
    const failures: string[] = [];
    for (const fx of fixtures) {
      const r = await extractPdfText(fx.pdf);
      if (!r.ok || r.empty) failures.push(fx.name);
    }
    expect(failures, `unparseable PDF fixtures: ${failures.join(", ")}`).toEqual([]);
  });

  it("every fixture's text contains its expected provider + amount markers", async () => {
    const fails: string[] = [];
    for (const fx of fixtures) {
      const r = await extractPdfText(fx.pdf);
      const text = r.text.toLowerCase();
      const provLower = fx.expected.provider.toLowerCase();
      const monthlyStr = (fx.expected.monthlyCents / 100).toFixed(2).replace(".", ",");
      // Provider name parts must appear; amount must appear in NL comma format
      const provHit = provLower.split(/[\s.]+/).every((part) => part.length < 3 || text.includes(part));
      const amtHit = text.includes(monthlyStr);
      if (!provHit || !amtHit) fails.push(`${fx.name} (prov=${provHit}, amt=${amtHit})`);
    }
    // Allow up to 10% of provider-name lookups to miss (e.g. "&" in "AT&T",
    // umlauts in "Univé" can render funky after PDF round-trip).
    const pass = fixtures.length - fails.length;
    expect(pass / fixtures.length, `text-match passes: ${pass}/${fixtures.length}\n  fails: ${fails.join("\n  ")}`).toBeGreaterThanOrEqual(0.9);
  });

  it("pass-rate ≥75% globally, ≥90% NL telecom (LIVE LLM only)", async () => {
    if (!hasLiveGroq) {
      console.log("SKIP — set GROQ_API_KEY to a real key to run this gate");
      return;
    }
    let globalPass = 0;
    let nlTelTotal = 0;
    let nlTelPass = 0;
    const report: string[] = [];

    for (const fx of fixtures) {
      const r = await extractBill(fx.pdf, "application/pdf");
      const providerMatch =
        r.provider &&
        r.provider.toLowerCase().includes(fx.expected.provider.toLowerCase().split(/[\s.]+/)[0]);
      const amountOk =
        r.amountCents != null &&
        Math.abs(r.amountCents - fx.expected.monthlyCents) <= 200;
      const ok = !!providerMatch && amountOk;
      if (ok) globalPass++;
      if (fx.expected.country === "NL" && fx.expected.category === "TELECOM") {
        nlTelTotal++;
        if (ok) nlTelPass++;
      }
      report.push(`${ok ? "✓" : "✗"} ${fx.name} prov=${r.provider} amt=${r.amountCents}`);
    }

    const globalPct = globalPass / fixtures.length;
    const nlTelPct = nlTelTotal > 0 ? nlTelPass / nlTelTotal : 1;
    fs.writeFileSync(
      path.join(FIX_DIR, "REPORT.md"),
      `# OCR fixture pass-rate\n\nGlobal: ${globalPass}/${fixtures.length} = ${(globalPct * 100).toFixed(0)}%\nNL telecom: ${nlTelPass}/${nlTelTotal} = ${(nlTelPct * 100).toFixed(0)}%\n\n${report.join("\n")}\n`,
    );
    console.log(`global ${(globalPct * 100).toFixed(0)}% · NL telecom ${(nlTelPct * 100).toFixed(0)}%`);
    expect(globalPct).toBeGreaterThanOrEqual(0.75);
    expect(nlTelPct).toBeGreaterThanOrEqual(0.9);
  }, 600_000);

  it("without LIVE LLM key, extractBill returns needsManual + a PDF marker", async () => {
    if (hasLiveGroq) return;
    const fx = fixtures[0];
    if (!fx) return;
    const r = await extractBill(fx.pdf, "application/pdf");
    expect(r.ok).toBe(false);
    expect(r.needsManual).toBe(true);
    expect(r.rawText).toMatch(/PDF_(OCR_SKIPPED|LLM_ERR|PARSE_LOW_CONFIDENCE|EXTRACT_FAIL|SCAN_NO_TEXT)/);
  });
});
