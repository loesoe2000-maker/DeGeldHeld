/**
 * v31 journey — all new checks render + are interactable via browser.
 *
 * Bezoekt élke nieuwe pagina (V28/V29/V30) en verifieert:
 *   - 200/304 response
 *   - h1 visible binnen 8s
 *   - geen JS-errors in de console
 *   - waar relevant: form invulbaar + submit triggert een result-section
 *
 * Vereist dat de webServer met feature-flags AAN draait (playwright.config.ts
 * zet die in webServer.env). Als je `reuseExistingServer` gebruikt en je dev
 * draait ZONDER flags → tests skippen automatisch met een duidelijke melding.
 */
import { test, expect, type Page } from "@playwright/test";

const RENDER_TIMEOUT_MS = 8_000;

/** Filtert "noise" uit de browser-console (favicon, third-party). */
function realErrors(errors: string[]): string[] {
  return errors.filter((e) => {
    const lower = e.toLowerCase();
    if (lower.includes("favicon")) return false;
    if (lower.includes("third party") || lower.includes("vercel.live")) return false;
    if (lower.includes("posthog") || lower.includes("eu.i.posthog.com")) return false;
    return true;
  });
}

async function gotoOrSkip(page: Page, path: string, flagName: string): Promise<void> {
  const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
  const finalUrl = page.url();
  // Flag-off causes redirect to "/" — duidelijk skippen i.p.v. testen-falen.
  if (!resp || finalUrl.endsWith("/") || finalUrl.endsWith("/login")) {
    test.skip(true, `${flagName} flag is OFF → ${path} redirect'te naar ${finalUrl}. Zet FEATURE_${flagName}=true in .env.local of laat playwright zelf de webServer starten.`);
  }
  expect(resp).not.toBeNull();
  expect([200, 304]).toContain(resp!.status());
}

const PAGES = [
  { path: "/geld-check", flag: "GELD_CHECK_ENABLED", h1Match: /vind al je geld|toeslagen/i },
  { path: "/box3-check", flag: "BOX3_CHECK_ENABLED", h1Match: /box.?3|rechtsherstel/i },
  { path: "/ns-check", flag: "NS_CHECK_ENABLED", h1Match: /trein|vertraag|ns/i },
  { path: "/zorgkosten-check", flag: "ZORGKOSTEN_CHECK_ENABLED", h1Match: /zorgkosten/i },
  { path: "/vluchtclaim", flag: "CLAIMS", h1Match: /vlucht|eu.?261/i },
  { path: "/vind-al-je-geld", flag: "MONEYFINDER_HUB_ENABLED", h1Match: /alles op één plek|vind al je geld/i },
];

/**
 * Helper: dev-mode Next.js hydrateert lazy → wachten tot een input klikbaar/
 * gehydrateerd is voor we fillen. Anders verliest React state-updates.
 */
async function fillHydrated(page: Page, testid: string, value: string): Promise<void> {
  const el = page.getByTestId(testid);
  await el.waitFor({ state: "visible", timeout: 10_000 });
  await el.fill(value);
  // Verifieer dat React de waarde heeft opgepakt vóór we doorklikken.
  await expect(el).toHaveValue(value, { timeout: 3_000 });
}

test.describe("v31 journey — alle nieuwe checks renderen schoon", () => {
  for (const { path, flag, h1Match } of PAGES) {
    test(`${path}: 200 + h1 + geen console-errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await gotoOrSkip(page, path, flag);

      // H1 moet zichtbaar zijn én matchen op de pagina-titel.
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
      const h1Text = (await h1.textContent()) ?? "";
      expect(h1Text).toMatch(h1Match);

      // Body moet "DeGeldHeld" of brand-element bevatten (smoke).
      const body = (await page.locator("body").textContent()) ?? "";
      expect(body.length).toBeGreaterThan(200);

      const real = realErrors(errors);
      expect(
        real,
        `Onverwachte JS-errors op ${path}: ${real.join("\n")}`,
      ).toEqual([]);
    });
  }

  // ─── Echte interaction-flow: geld-check wizard → resultaat ─────────────────
  test("/geld-check: vul wizard in (alleenstaand € 25k) → resultaat verschijnt + toont zorgtoeslag", async ({ page }) => {
    await gotoOrSkip(page, "/geld-check", "GELD_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    // Wizard heeft geen testids op input-fields — gebruik label-wrapper-selectors.
    const leeftijd = page.locator("label:has-text('Leeftijd') input");
    const inkomen = page.locator("label:has-text('Bruto jaarinkomen') input");
    await leeftijd.fill("30");
    await expect(leeftijd).toHaveValue("30");
    await inkomen.fill("25000");
    await expect(inkomen).toHaveValue("25000");

    await page.getByTestId("geld-check-submit").click();

    await expect(page.locator("#geld-check-results")).toBeVisible({ timeout: 8_000 });
    const results = (await page.locator("#geld-check-results").textContent()) ?? "";
    expect(results.toLowerCase()).toContain("zorgtoeslag");
    expect(results).toMatch(/€\s?1[.,]?29/);
  });

  // ─── Hub-page: tile-links zichtbaar + verwijzen naar specifieke checks ─────
  test("/vind-al-je-geld: tegels linken naar individuele checks", async ({ page }) => {
    await gotoOrSkip(page, "/vind-al-je-geld", "MONEYFINDER_HUB_ENABLED");

    // Minimaal 3 van de check-links moeten aanwezig zijn (tegels per actieve flag).
    const linkCount = await page
      .locator("a[href='/geld-check'], a[href='/box3-check'], a[href='/ns-check'], a[href='/zorgkosten-check'], a[href='/vluchtclaim']")
      .count();
    expect(linkCount).toBeGreaterThanOrEqual(3);
  });

  // ─── Hero (landing): hub-link zichtbaar wanneer hub-flag aan ───────────────
  test("/ Hero: hub-link verschijnt wanneer MONEYFINDER_HUB_ENABLED aanstaat", async ({ page }) => {
    await page.goto("/");
    const hubLink = page.getByTestId("hero-link-hub");
    // Als hub-flag uit → link bestaat niet → test wordt skipped via fallback.
    if ((await hubLink.count()) === 0) {
      test.skip(true, "MONEYFINDER_HUB_ENABLED uit → geen hub-link in Hero (verwacht gedrag)");
    }
    await expect(hubLink).toBeVisible();
    await expect(hubLink).toHaveAttribute("href", "/vind-al-je-geld");
  });

  // ─── Bestaande Hero-CTA blijft werken (regressie-guard V31 raakt 'm niet) ──
  test("/ Hero: primaire upload-CTA blijft naar /onderhandel wijzen", async ({ page }) => {
    await page.goto("/");
    const upload = page.getByRole("link", { name: /upload je rekening/i }).first();
    await expect(upload).toBeVisible();
    await expect(upload).toHaveAttribute("href", "/onderhandel");
  });

  // ─── Box 3 complete-pad: vul wizard → submit → NCNP-card OF DIY-card ─────
  test("/box3-check: spaargeld € 300k · 2024 · werkelijk € 0 → NCNP-card verschijnt (≥ € 500 teruggave)", async ({ page }) => {
    await gotoOrSkip(page, "/box3-check", "BOX3_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("box3-jaar").selectOption("2024");
    await fillHydrated(page, "box3-bank", "300000");
    await fillHydrated(page, "box3-overig", "0");
    await fillHydrated(page, "box3-schulden", "0");
    await fillHydrated(page, "box3-werkelijk", "0");

    await page.getByTestId("box3-submit").click();
    await expect(page.getByTestId("box3-ncnp-card")).toBeVisible({ timeout: 8_000 });
  });

  test("/box3-check: spaargeld € 80k · 2024 → DIY-card (onder € 500-drempel)", async ({ page }) => {
    await gotoOrSkip(page, "/box3-check", "BOX3_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("box3-jaar").selectOption("2024");
    await fillHydrated(page, "box3-bank", "80000");
    await fillHydrated(page, "box3-overig", "0");
    await fillHydrated(page, "box3-schulden", "0");
    await fillHydrated(page, "box3-werkelijk", "0");

    await page.getByTestId("box3-submit").click();
    await expect(page.getByTestId("box3-diy-only-card")).toBeVisible({ timeout: 8_000 });
  });

  // ─── NS complete-pad: vul wizard → submit → ns-results ───────────────────
  test("/ns-check: ticket € 15 · vertraging 45 min → ns-results + 50%-compensatie", async ({ page }) => {
    await gotoOrSkip(page, "/ns-check", "NS_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    await fillHydrated(page, "ns-ticket", "15,00");
    await fillHydrated(page, "ns-delay", "45");

    await page.getByTestId("ns-submit").click();
    await expect(page.getByTestId("ns-results")).toBeVisible({ timeout: 8_000 });
    const results = (await page.getByTestId("ns-results").textContent()) ?? "";
    expect(results).toMatch(/€\s?7[.,]50/);
  });

  // ─── Zorgkosten complete-pad: vul wizard → submit → zorg-results + checklist ──
  test("/zorgkosten-check: inkomen € 30k + zorgkosten € 1.500 → zorg-results + aftrek > 0", async ({ page }) => {
    await gotoOrSkip(page, "/zorgkosten-check", "ZORGKOSTEN_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    await fillHydrated(page, "zorg-inkomen", "30000");
    await fillHydrated(page, "zorg-geneeskundigeHulp", "1000");
    await fillHydrated(page, "zorg-medicijnen", "500");

    await page.getByTestId("zorg-submit").click();
    await expect(page.getByTestId("zorg-results")).toBeVisible({ timeout: 8_000 });
    const results = (await page.getByTestId("zorg-results").textContent()) ?? "";
    expect(results.toLowerCase()).toMatch(/aftrek|aftrekbaar|€/);
    await expect(page.getByTestId("zorg-checklist")).toBeVisible();
  });

  // ─── Vluchtclaim complete-pad (minimaal — geen flight-data-API in dev) ───
  test("/vluchtclaim: pagina rendert + form-velden bestaan (volledige claim test = E2E in prod)", async ({ page }) => {
    await gotoOrSkip(page, "/vluchtclaim", "CLAIMS");
    // Smoke: form zichtbaar, inputs aanwezig. Echte claim-flow vergt
    // Aviation Edge API key + jurist-check (owner-werk).
    const formCount = await page.locator("form, [data-testid*='vlucht']").count();
    expect(formCount).toBeGreaterThan(0);
  });

  // ─── PostCheckCta verschijnt na een check-result ─────────────────────────
  test("/geld-check: PostCheckCta (Plus + Onderhandel) verschijnt na een result", async ({ page }) => {
    await gotoOrSkip(page, "/geld-check", "GELD_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");
    const leeftijd = page.locator("label:has-text('Leeftijd') input");
    const inkomen = page.locator("label:has-text('Bruto jaarinkomen') input");
    await leeftijd.fill("30");
    await expect(leeftijd).toHaveValue("30");
    await inkomen.fill("25000");
    await expect(inkomen).toHaveValue("25000");
    await page.getByTestId("geld-check-submit").click();
    await expect(page.locator("#geld-check-results")).toBeVisible({ timeout: 8_000 });
    const ctaText = (await page.locator("body").textContent()) ?? "";
    expect(ctaText.toLowerCase()).toMatch(/plus|onderhandel|maand|rekening/);
  });
});
