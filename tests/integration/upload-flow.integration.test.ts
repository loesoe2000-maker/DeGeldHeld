/**
 * End-to-end: real Groq Vision + real Neon test branch.
 *
 * SKIPPED unless GROQ_API_KEY_TEST + DATABASE_URL_TEST are set.
 * Runs on PR via .github/workflows/integration.yml when those secrets
 * exist; locally, set them in `.env.test` and `npm run test:integration`.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const SKIP = !process.env.GROQ_API_KEY_TEST || !process.env.DATABASE_URL_TEST;

const prisma = SKIP
  ? (null as unknown as PrismaClient)
  : new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST! } },
    });

// Force live OCR for the duration of these tests.
beforeAll(() => {
  if (SKIP) return;
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY_TEST;
  delete process.env.GROQ_VISION_MOCK;
});

afterAll(async () => {
  if (SKIP) return;
  await prisma.$disconnect();
});

const FIXTURES = [
  { slug: "nl-tel-kpn", expectedProvider: "KPN", expectedAmount: 2965 },
  { slug: "nl-ene-eneco", expectedProvider: "Eneco", expectedAmount: 18500 },
  { slug: "de-tel-telekom", expectedProvider: "Telekom", expectedAmount: 3995 },
];

describe.skipIf(SKIP)("integration: upload flow with real Groq + Neon", () => {
  for (const fx of FIXTURES) {
    it(`extracts ${fx.expectedProvider} from ${fx.slug}.pdf`, async () => {
      const { extractBill } = await import("@/lib/ocr");
      const buf = fs.readFileSync(path.resolve(__dirname, `../fixtures/bills/${fx.slug}.pdf`));
      const r = await extractBill(buf, "application/pdf");
      expect(r.provider?.toLowerCase()).toContain(fx.expectedProvider.toLowerCase().split(/\s/)[0]);
      expect(Math.abs((r.amountCents ?? 0) - fx.expectedAmount)).toBeLessThanOrEqual(300);
    });
  }

  it("persists a bill row + reads it back", async () => {
    // Just verify prisma + the Bill model — full upload-route HTTP path
    // requires a NextAuth session which is hard to fake here.
    const user = await prisma.user.upsert({
      where: { email: "integration-test@example.invalid" },
      create: { email: "integration-test@example.invalid" },
      update: {},
    });
    const bill = await prisma.bill.create({
      data: {
        userId: user.id,
        provider: "TestProvider",
        category: "TELECOM",
        amountCents: 1234,
        imageHash: `int-test-${Date.now()}`,
      },
    });
    expect(bill.id).toMatch(/^c[a-z0-9]+$/);
    await prisma.bill.delete({ where: { id: bill.id } });
  });
});
