import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config voor end-to-end happy-path tests.
 * Run: `npm run test:e2e`
 *
 * webServer start `next dev` op port 3000. Setup gebruikt GROQ_VISION_MOCK=1
 * env-flag (zie lib/ocr.ts) zodat we geen echte Groq-API call doen.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "html",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      GROQ_VISION_MOCK: "1",
      NODE_ENV: "development",
    },
  },
});
