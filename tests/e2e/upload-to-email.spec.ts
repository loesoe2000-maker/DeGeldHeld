import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

/**
 * E2E happy-path: gebruiker is ingelogd, upload een (mock) KPN factuur,
 * landt op /onderhandel/analyse met besparing, klikt door naar email-pagina.
 *
 * Pre-condities:
 *  - `npm run dev` draait via webServer (zie playwright.config.ts)
 *  - GROQ_VISION_MOCK=1 zit in webServer env → extractBill returnt vaste KPN response
 *  - NEXTAUTH_SECRET in .env (anders cookie ongeldig)
 */

const prisma = new PrismaClient();
const TEST_EMAIL = `playwright-e2e-${Date.now()}@degeldheld.test`;
let testUserId: string;
let sessionCookie: string;

test.beforeAll(async () => {
  // 1. Maak een test-user (idempotent via unique email)
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      name: "Playwright E2E",
      emailVerified: new Date(),
    },
  });
  testUserId = user.id;

  // 2. Genereer een geldige JWT die NextAuth's session-decoder accepteert.
  // NextAuth v5 default cookie name in dev (non-https): "authjs.session-token".
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "test-secret";
  sessionCookie = await encode({
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    salt: "authjs.session-token",
    maxAge: 60 * 60 * 24,
  });
});

test.afterAll(async () => {
  // Cleanup test user + alle bills/negotiations (cascade)
  if (testUserId) {
    await prisma.user.deleteMany({ where: { id: testUserId } });
  }
  await prisma.$disconnect();
});

test("uploadt factuur en ziet besparing + onderhandel-email", async ({ page, context }) => {
  // Set cookie BEFORE navigating
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: sessionCookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // Stap 1: ga naar /onderhandel
  await page.goto("/onderhandel");
  await expect(page).toHaveURL(/\/onderhandel\b/);

  // Stap 2: upload de PNG fixture (Groq Vision is gemockt → KPN response)
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles("tests/fixtures/kpn-sample.png");

  // Stap 3: wacht tot we op /onderhandel/analyse landen
  await page.waitForURL(/\/onderhandel\/analyse/, { timeout: 30000 });

  // Stap 4: KPN data zichtbaar
  await expect(page.locator("body")).toContainText("KPN");
  await expect(page.locator("body")).toContainText("€");
  await expect(page.locator("body")).toContainText(/besparing/i);

  // Stap 5: klik "Genereer onderhandel-email"
  await page.getByText(/Genereer onderhandel-email/i).click();
  await page.waitForURL(/\/onderhandel\/email/, { timeout: 30000 });

  // Stap 6: email-preview bevat klantnummer (12345678) en bedrag (24,66)
  const body = page.locator("body");
  await expect(body).toContainText("KPN");
  // Klantnummer of bedrag — afhankelijk van fallback template (geen Groq LLM)
  // mag minimaal het provider-bedrag tonen.
  await expect(body).toContainText(/€\s*24,?66|24\.66|2466/);
});
