/**
 * v34 ASSURANCE — coverage-uitbreidingen op de v31 e2e-baseline.
 *
 * Drie focusgebieden, géén nieuwe features:
 *   (a) iPhone-12 viewport → 3 check-paden submitten + form-velden bereikbaar
 *       (sticky submit-CTA blijft visible na scroll, geen overlapping van NAV)
 *   (b) Error-paths → leeg-form-submit per check → role="alert" verschijnt
 *       (niet stille fail). Engines hebben al unit-tests; de UI-melding niet.
 *   (c) Network-failure simulatie /api/box3/claim → user krijgt een nette
 *       foutmelding via data-testid="box3-ncnp-error", géén crash.
 *
 * Vereist dezelfde feature-flags AAN als journey-v31; playwright.config.ts
 * doet dat al voor de webServer.
 */
import { test, expect, devices, type Page } from "@playwright/test";

const RENDER_TIMEOUT_MS = 8_000;

async function gotoOrSkip(page: Page, path: string, flagName: string): Promise<void> {
  const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
  const finalUrl = page.url();
  if (!resp || finalUrl.endsWith("/") || finalUrl.endsWith("/login")) {
    test.skip(true, `${flagName} flag is OFF → ${path} redirect'te naar ${finalUrl}.`);
  }
  expect(resp).not.toBeNull();
  expect([200, 304]).toContain(resp!.status());
}

async function fillHydrated(page: Page, testid: string, value: string): Promise<void> {
  const el = page.getByTestId(testid);
  await el.waitFor({ state: "visible", timeout: 10_000 });
  await el.fill(value);
  await expect(el).toHaveValue(value, { timeout: 3_000 });
}

// ─── (a) MOBILE — iPhone 12 viewport ────────────────────────────────────────

test.describe("v34 mobile (iPhone-12) — 3 check-paden submitten zonder layout-fail", () => {
  test.use({ ...devices["iPhone 12"] });

  test("/geld-check (mobile): submit-CTA reachable + wizard fillable + result visible", async ({ page }) => {
    await gotoOrSkip(page, "/geld-check", "GELD_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    // Form-velden zonder testid → label-wrapper-selectors (zoals in v31).
    const leeftijd = page.locator("label:has-text('Leeftijd') input");
    const inkomen = page.locator("label:has-text('Bruto jaarinkomen') input");
    await expect(leeftijd).toBeVisible();
    await expect(inkomen).toBeVisible();
    await leeftijd.fill("30");
    await inkomen.fill("25000");

    // Submit-CTA moet bereikbaar zijn op mobile — testid in viewport scroll-bar.
    const submit = page.getByTestId("geld-check-submit");
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    // Tap geeft een betere mobile-emulatie dan click.
    await submit.tap();

    await expect(page.locator("#geld-check-results")).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
    const text = (await page.locator("#geld-check-results").textContent()) ?? "";
    expect(text.toLowerCase()).toContain("zorgtoeslag");
  });

  test("/box3-check (mobile): jaar-select + bedrag-input bereikbaar, submit toont card", async ({ page }) => {
    await gotoOrSkip(page, "/box3-check", "BOX3_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    const jaarSel = page.getByTestId("box3-jaar");
    await expect(jaarSel).toBeVisible();
    await jaarSel.selectOption("2024");

    await fillHydrated(page, "box3-bank", "300000");
    await fillHydrated(page, "box3-overig", "0");
    await fillHydrated(page, "box3-schulden", "0");
    await fillHydrated(page, "box3-werkelijk", "0");

    const submit = page.getByTestId("box3-submit");
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    await submit.tap();

    await expect(page.getByTestId("box3-ncnp-card")).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
  });

  test("/ns-check (mobile): ticket + delay invulbaar, submit toont compensatie", async ({ page }) => {
    await gotoOrSkip(page, "/ns-check", "NS_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");

    await fillHydrated(page, "ns-ticket", "15,00");
    await fillHydrated(page, "ns-delay", "45");

    const submit = page.getByTestId("ns-submit");
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    await submit.tap();

    await expect(page.getByTestId("ns-results")).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
    const text = (await page.getByTestId("ns-results").textContent()) ?? "";
    // bron: V29_DATA_2026.md — ticket € 15 · 45 min = 50% = € 7,50
    expect(text).toMatch(/€\s?7[.,]50/);
  });
});

// ─── (b) ERROR-PATH — empty submit → alert visible (niet stille fail) ────────

test.describe("v34 error-path — leeg-submit toont nette UI-foutmelding", () => {
  test("/geld-check: submit zonder leeftijd → role='alert' + 'leeftijd'-tekst", async ({ page }) => {
    await gotoOrSkip(page, "/geld-check", "GELD_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");
    // Direct op submit, geen velden ingevuld.
    await page.getByTestId("geld-check-submit").click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible({ timeout: 3_000 });
    expect((await alert.textContent())?.toLowerCase() ?? "").toMatch(/leeftijd/);
  });

  test("/box3-check: submit zonder bedragen → role='alert' + 'banktegoeden'-tekst", async ({ page }) => {
    await gotoOrSkip(page, "/box3-check", "BOX3_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("box3-submit").click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible({ timeout: 3_000 });
    expect((await alert.textContent())?.toLowerCase() ?? "").toMatch(/banktegoeden|spaargeld/);
  });

  test("/ns-check: submit zonder ticket → role='alert' + 'ticketprijs'-tekst", async ({ page }) => {
    await gotoOrSkip(page, "/ns-check", "NS_CHECK_ENABLED");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("ns-submit").click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible({ timeout: 3_000 });
    expect((await alert.textContent())?.toLowerCase() ?? "").toMatch(/ticket/);
  });
});

// ─── (c) NETWORK-FAILURE — /api/box3/claim 500 → nette UI-foutmelding ───────

test.describe("v34 netwerk-fout — /api/box3/claim faalt → user ziet box3-ncnp-error", () => {
  test("/box3-check: ≥ € 500 teruggave + /api/box3/claim → 500 → ncnp-error visible (geen crash)", async ({ page }) => {
    // bron: V29_DATA_2026.md banktegoeden 2024 forfait 1,44% → € 300k geeft
    // verwachte teruggave > € 500 → NCNP-card verschijnt → claim-knop POST't.
    await gotoOrSkip(page, "/box3-check", "BOX3_CHECK_ENABLED");

    // Intercept eerst, vóór we de NCNP-knop klikken.
    await page.route("**/api/box3/claim", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, reason: "intern" }),
      });
    });

    await page.waitForLoadState("networkidle");

    await page.getByTestId("box3-jaar").selectOption("2024");
    await fillHydrated(page, "box3-bank", "300000");
    await fillHydrated(page, "box3-overig", "0");
    await fillHydrated(page, "box3-schulden", "0");
    await fillHydrated(page, "box3-werkelijk", "0");
    await page.getByTestId("box3-submit").click();

    const ncnpCard = page.getByTestId("box3-ncnp-card");
    await expect(ncnpCard).toBeVisible({ timeout: RENDER_TIMEOUT_MS });

    // Find + klik de claim-knop binnen de NCNP-card.
    const claimBtn = ncnpCard.getByRole("button").first();
    await claimBtn.click();

    const errEl = page.getByTestId("box3-ncnp-error");
    await expect(errEl).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
    const errText = (await errEl.textContent())?.toLowerCase() ?? "";
    expect(errText).toMatch(/probeer|opnieuw|fout|onder|drempel/);
  });

  test("/box3-check: /api/box3/claim 401 → user ziet auth-prompt, geen crash", async ({ page }) => {
    await gotoOrSkip(page, "/box3-check", "BOX3_CHECK_ENABLED");

    await page.route("**/api/box3/claim", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    await page.waitForLoadState("networkidle");

    await page.getByTestId("box3-jaar").selectOption("2024");
    await fillHydrated(page, "box3-bank", "300000");
    await fillHydrated(page, "box3-overig", "0");
    await fillHydrated(page, "box3-schulden", "0");
    await fillHydrated(page, "box3-werkelijk", "0");
    await page.getByTestId("box3-submit").click();

    const ncnpCard = page.getByTestId("box3-ncnp-card");
    await expect(ncnpCard).toBeVisible({ timeout: RENDER_TIMEOUT_MS });

    const claimBtn = ncnpCard.getByRole("button").first();
    await claimBtn.click();

    // Auth-state moet zichtbaar zijn (NCNP-card biedt login-prompt of -link).
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body.toLowerCase()).toMatch(/login|inloggen|account|aanmelden/);
  });
});
