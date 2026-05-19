import { defineConfig, devices } from "@playwright/test";

/**
 * Production user-journey test config (v16).
 *
 * Runs against the live deploy at PROD_URL (default
 * https://www.degeldheld.com — the apex degeldheld.com redirects
 * to www so we point at the canonical host directly).
 *
 * Doesn't spin up a webServer — the journey-tests hit prod.
 *
 * Run:
 *   npx playwright test --config playwright.prod.config.ts
 *
 * Single-worker so parallel anon-cookie races don't blow up
 * the per-IP rate-limit.
 */
const PROD = process.env.PROD_URL ?? "https://www.degeldheld.com";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /journey-.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  use: {
    baseURL: PROD,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Mobile viewport via Chromium — sidesteps the WebKit binary
      // requirement while validating the responsive layout. Pixel 7
      // gives 412×915 + DPR 2.625, a faithful "modern Android".
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: /journey-1-landing\.spec\.ts$/,
    },
  ],
});
