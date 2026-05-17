/**
 * scripts/mobile-audit.ts
 *
 * Headless Playwright pass at 375×812 (iPhone 12 Mini frame) over every
 * public route. Per page:
 *
 *   - takes a PNG into tests/screenshots/mobile/
 *   - flags horizontal scroll (body.scrollWidth > 375)
 *   - flags touch-targets <44×44 px (Apple HIG)
 *   - flags content overlapped by the status-bar area (any element
 *     with top:0 that sits visually behind another)
 *
 * Run:
 *   npx tsx scripts/mobile-audit.ts
 *   BASE_URL=http://localhost:3000 npx tsx scripts/mobile-audit.ts
 */
export {};

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "https://www.degeldheld.com").replace(/\/$/, "");
const VIEW = { width: 375, height: 812 };
const PAGES = ["/", "/login", "/proof", "/faq"];
const SCREENSHOT_DIR = path.resolve(__dirname, "../tests/screenshots/mobile");

type Finding = {
  page: string;
  horizontalScroll: boolean;
  bodyScrollWidth: number;
  smallTouchTargets: number; // count of buttons / links smaller than 44×44
  overlapTop: boolean;       // something pinned to top is overlapping content
};

async function audit() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 });
  const findings: Finding[] = [];

  for (const route of PAGES) {
    const page = await ctx.newPage();
    const url = `${BASE}${route}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(500);

      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const horizontalScroll = bodyScrollWidth > VIEW.width;

      const smallTouchTargets = await page.evaluate(() => {
        const sel = 'a, button, input[type="submit"], [role="button"]';
        const elements = Array.from(document.querySelectorAll(sel));
        return elements.filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          // ignore offscreen
          if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
          return rect.width < 44 || rect.height < 44;
        }).length;
      });

      const overlapTop = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("*"));
        const fixed = els.filter((el) => {
          const cs = getComputedStyle(el);
          return (cs.position === "fixed" || cs.position === "sticky") &&
            el.getBoundingClientRect().top <= 0;
        });
        const heroish = document.querySelector("h1, h2");
        if (!heroish || fixed.length === 0) return false;
        const heroRect = heroish.getBoundingClientRect();
        return fixed.some((f) => {
          const r = f.getBoundingClientRect();
          return r.bottom > heroRect.top && r.left < heroRect.right && r.right > heroRect.left;
        });
      });

      const fname = route === "/" ? "home.png" : `${route.replace(/\//g, "_")}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, fname), fullPage: true });

      findings.push({ page: route, horizontalScroll, bodyScrollWidth, smallTouchTargets, overlapTop });
      console.log(
        `${route.padEnd(20)} hScroll=${horizontalScroll} (${bodyScrollWidth}px) ` +
        `tinyTargets=${smallTouchTargets} overlap=${overlapTop}`,
      );
    } catch (e) {
      console.error(`${route} — fetch error: ${(e as Error).message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const broken = findings.filter(
    (f) => f.horizontalScroll || f.smallTouchTargets > 0 || f.overlapTop,
  );
  if (broken.length > 0) {
    console.error(`\n${broken.length} mobile issues:`);
    for (const f of broken) console.error(`  ${f.page}: ${JSON.stringify(f)}`);
    process.exit(1);
  } else {
    console.log("\nNo mobile issues found.");
  }
}

void audit();
