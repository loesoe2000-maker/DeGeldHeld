import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Playwright config voor end-to-end happy-path tests.
 * Run: `npm run test:e2e`
 *
 * webServer start `next dev` op port 3000. Setup gebruikt GROQ_VISION_MOCK=1
 * env-flag (zie lib/ocr.ts) zodat we geen echte Groq-API call doen.
 *
 * ENV-ALIGNMENT (v26): sommige specs praten DIRECT met de database
 * (`prisma.*` in beforeAll) en tekenen zelf een sessie-cookie (`encode`) of
 * een outcome-HMAC-token (`signOutcomeToken`) in het test-runner-proces. De
 * dev-server moet die met DEZELFDE database + secret valideren. De runner
 * laadt `.env.local` niet (Next.js doet dat alleen voor de server, en Prisma
 * pakt alleen `.env` — vaak een verouderd Neon-endpoint). Zonder uitlijning:
 *   - prisma in beforeAll → "Can't reach database server" (stale .env), en
 *   - cookie/outcome-token → /login-redirect (secret-mismatch).
 * Daarom laden we hier `.env.local` in de runner (zelfde DB + secrets als de
 * server) en pinnen we één set secrets voor BEIDE processen.
 *
 * Bewust géén `dotenv`-import (geen directe dependency): een minimale loader
 * die KEY=VALUE leest en bestaande env-vars NIET overschrijft.
 */
function loadEnvFile(path: string): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return; // file ontbreekt → niets te doen
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue; // never override
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(".env.local"); // current DB + secrets (precedence)
loadEnvFile(".env"); // fill gaps; never overrides already-set vars

const AUTH_SECRET =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "e2e-auth-secret-deterministic-0123456789";
const OUTCOME_TOKEN_SECRET =
  process.env.OUTCOME_TOKEN_SECRET ?? process.env.CRON_SECRET ?? "e2e-outcome-token-secret-0123456789";

// Force the runner (and its worker processes) onto the same values the
// webServer gets, so encode()/signOutcomeToken() in specs match the server.
process.env.AUTH_SECRET = AUTH_SECRET;
process.env.NEXTAUTH_SECRET = AUTH_SECRET;
process.env.OUTCOME_TOKEN_SECRET = OUTCOME_TOKEN_SECRET;

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
      // Same secrets as the runner → self-signed cookie/token validate server-side.
      AUTH_SECRET,
      NEXTAUTH_SECRET: AUTH_SECRET,
      OUTCOME_TOKEN_SECRET,
    },
  },
});
