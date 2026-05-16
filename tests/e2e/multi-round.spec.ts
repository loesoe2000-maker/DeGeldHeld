import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { signOutcomeToken } from "../../lib/outcome_token";

/**
 * E2E: full multi-round + outcome flow.
 *
 *   upload → email → "kreeg antwoord" → plak response → counter mail
 *   simulate 7d later → uitkomst pagina form
 */

const prisma = new PrismaClient();
const TEST_EMAIL = `playwright-rounds-${Date.now()}@degeldheld.test`;
let testUserId: string;
let testBillId: string;
let testNegotiationId: string;
let sessionCookie: string;

test.beforeAll(async () => {
  // Make sure outcome_token has a secret in this process
  process.env.OUTCOME_TOKEN_SECRET =
    process.env.OUTCOME_TOKEN_SECRET ?? process.env.CRON_SECRET ?? "test-secret-32-bytes-or-more";

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: { email: TEST_EMAIL, name: "Rounds E2E", emailVerified: new Date() },
  });
  testUserId = user.id;

  const bill = await prisma.bill.create({
    data: {
      userId: user.id,
      provider: "KPN",
      category: "TELECOM",
      amountCents: 2466,
      monthlyCents: 2466,
      plan: "Compleet",
      period: "mei 2026",
      customerNumber: "12345678",
      imageHash: `e2e-rounds-${Date.now()}`,
      country: "NL",
      currency: "EUR",
    },
  });
  testBillId = bill.id;

  const neg = await prisma.negotiation.create({
    data: {
      userId: user.id,
      billId: bill.id,
      state: "EMAIL_SENT",
      emailSentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      expectedSavingsCents: 5000,
      emailSubject: "Verzoek tariefherziening KPN",
      emailBody: "Geachte heer/mevrouw, ...",
      strategy: "RETENTIE_DREIG",
      confidence: 0.8,
    },
  });
  testNegotiationId = neg.id;

  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "test-secret";
  sessionCookie = await encode({
    token: { id: user.id, sub: user.id, email: user.email, name: user.name },
    secret,
    salt: "authjs.session-token",
    maxAge: 60 * 60 * 24,
  });
});

test.afterAll(async () => {
  if (testUserId) {
    await prisma.user.deleteMany({ where: { id: testUserId } });
  }
  await prisma.$disconnect();
});

test("multi-round: plak provider-response, krijg counter-mail", async ({ page, context }) => {
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

  await page.goto(`/onderhandel/${testBillId}/ronde/1`);
  await expect(page.locator("body")).toContainText(/KPN/);
  await expect(page.locator("body")).toContainText(/Ronde 1/i);

  // Plak een typisch "constructief €22 aanbod" response
  await page
    .locator("textarea")
    .first()
    .fill(
      "Geachte heer/mevrouw, na overleg kunnen wij u een korting aanbieden, nieuwe prijs €22,50 per maand. Met vriendelijke groet, KPN retentie.",
    );
  await page.getByRole("button", { name: /Analyseer/i }).click();

  // Na refresh: analyse-chips zichtbaar
  await page.waitForLoadState("networkidle");
  const body = page.locator("body");
  await expect(body).toContainText(/Onze analyse/i);
});

test("outcome: token-link werkt zonder login", async ({ page, context }) => {
  // Clear cookies — outcome flow moet werken via HMAC token alleen
  await context.clearCookies();

  const token = signOutcomeToken(testBillId);
  await page.goto(`/onderhandel/${testBillId}/uitkomst?token=${encodeURIComponent(token)}`);

  const body = page.locator("body");
  // Page should render either the form or "already closed" — niet redirect naar /login
  await expect(page).not.toHaveURL(/\/login/);
  await expect(body).toContainText(/Hoe ging het|Uitkomst is al vastgelegd/i);
});
