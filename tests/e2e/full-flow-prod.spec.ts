/**
 * v14 DEEL 2 — full-flow happy path against production.
 *
 * STATUS: scaffold + TODO. The user has to run this with valid
 * envs because:
 *   - The magic-link login flow requires a real mailbox the test can
 *     poll. We support two pickup mechanisms:
 *       1. Resend's test inbox via RESEND_TEST_INBOX_API_KEY (preferred,
 *          configured in MANUAL_SETUP_REQUIRED §13).
 *       2. A MailHog instance at MAILHOG_URL (local dev fallback).
 *   - The test mutates the production database (creates a real user,
 *     uploads a real bill, etc.) so a dedicated test-tenant is needed.
 *
 * Why this is a scaffold: from the Claude harness we can't hit
 * https://degeldheld.com nor poll Resend's inbox. The shape of the
 * test below is correct; running it is a manual gate before launch.
 *
 * Run:
 *   PROD_URL=https://degeldheld.com \
 *   RESEND_TEST_INBOX_API_KEY=... \
 *   TEST_USER_EMAIL=e2e+full-flow@degeldheld.com \
 *   npx playwright test tests/e2e/full-flow-prod.spec.ts --headed --workers=1
 */
import { test, expect } from "@playwright/test";

const PROD_URL = process.env.PROD_URL ?? "https://degeldheld.com";
const TEST_EMAIL =
  process.env.TEST_USER_EMAIL ?? "e2e+full-flow@degeldheld.com";

// Skip the spec by default — only run when explicitly enabled, so this
// scaffold doesn't break CI without the right envs.
const enabled = process.env.RUN_FULL_FLOW_E2E === "1";
const describeMaybe = enabled ? test.describe : test.describe.skip;

describeMaybe("v14 full-flow against production", () => {
  test("happy path: signup → upload → analyse → email → ronde → uitkomst", async ({
    page,
  }) => {
    // Step 1 — homepage loads
    await page.goto(PROD_URL);
    await expect(page.locator("text=DeGeldHeld")).toBeVisible();

    // Step 2 — signup
    await page.goto(`${PROD_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/mail|inbox|verstuurd/i")).toBeVisible();

    // Step 3 — magic-link pickup. The pickup implementation lives in
    // tests/e2e/helpers/resend-inbox.ts (TODO file). For now we skip
    // the rest of the flow until the helper lands.
    test.skip(true, "magic-link pickup helper not yet implemented (DEEL 2 TODO)");

    // Step 4-12: see SPRINT doc — full flow continues here.
  });
});
