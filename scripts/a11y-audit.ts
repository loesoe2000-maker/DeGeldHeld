/**
 * scripts/a11y-audit.ts
 *
 * axe-core via Playwright over the main public pages. Prints critical
 * + serious WCAG 2.1 AA violations and exits non-zero if any are found.
 *
 * Run:
 *   npx tsx scripts/a11y-audit.ts
 *   BASE_URL=http://localhost:3000 npx tsx scripts/a11y-audit.ts
 */
export {};

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = (process.env.BASE_URL ?? "https://www.degeldheld.com").replace(/\/$/, "");
const PAGES = ["/", "/login", "/proof", "/faq"];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let totalViolations = 0;

  for (const route of PAGES) {
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      totalViolations += critical.length;
      console.log(`${route.padEnd(15)} ${critical.length} critical/serious violations`);
      for (const v of critical) {
        console.log(`  • ${v.id} (${v.impact}) — ${v.description}`);
        console.log(`    nodes: ${v.nodes.length}`);
        if (v.nodes[0]) {
          const html = v.nodes[0].html;
          console.log(`    first node: ${html.slice(0, 120)}`);
        }
      }
    } catch (e) {
      console.error(`${route} — axe error: ${(e as Error).message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  if (totalViolations > 0) {
    console.error(`\n${totalViolations} total critical/serious violations`);
    process.exit(1);
  }
  console.log("\nNo critical/serious WCAG AA violations.");
}

void main();
