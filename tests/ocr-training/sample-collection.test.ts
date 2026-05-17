import { describe, it, expect, vi, beforeEach } from "vitest";

const userFind = vi.fn();
const sampleCreate = vi.fn(async (a: unknown) => a);
vi.mock("../../lib/db", () => ({
  prisma: {
    user: { findUnique: (a: unknown) => userFind(a) },
    ocrTrainingSample: { create: (a: unknown) => sampleCreate(a) },
  },
}));

// Simulate the upload-route's training-collection snippet in isolation.
import { anonymizeStructured } from "../../lib/anonymizer";

async function collectTrainingSample(opts: {
  userId: string;
  bill: { category: string; country: string | null };
  ocr: {
    provider: string | null;
    amountCents: number | null;
    rawText: string;
    monthlyAmountCents?: number | null;
    plan?: string | null;
    period?: string | null;
    customerNumber?: string | null;
    language?: string | null;
    country?: string | null;
  };
}) {
  const { prisma } = await import("../../lib/db");
  const u = await prisma.user.findUnique({ where: { id: opts.userId }, select: { ocrTrainingOptIn: true } });
  if (!u?.ocrTrainingOptIn) return null;
  const sample = anonymizeStructured({
    provider: opts.ocr.provider,
    amountCents: opts.ocr.amountCents,
    monthlyAmountCents: opts.ocr.monthlyAmountCents,
    plan: opts.ocr.plan,
    period: opts.ocr.period,
    customerNumber: opts.ocr.customerNumber,
    language: opts.ocr.language,
    country: opts.ocr.country,
    rawText: opts.ocr.rawText,
  });
  return await prisma.ocrTrainingSample.create({
    data: {
      userId: opts.userId,
      imageStorageUrl: null,
      anonymizedJson: JSON.stringify(sample),
      billCategory: opts.bill.category,
      country: opts.bill.country ?? "NL",
    },
  });
}

beforeEach(() => {
  userFind.mockReset();
  sampleCreate.mockReset().mockResolvedValue({ id: "s1" });
});

describe("training sample collection (opt-in)", () => {
  const ocr = {
    provider: "KPN",
    amountCents: 2965,
    rawText: "Geachte Jan Janssen, klantnummer 12345678",
    customerNumber: "12345678",
  };
  const bill = { category: "TELECOM", country: "NL" };

  it("opt-in user → sample created with anonymized JSON", async () => {
    userFind.mockResolvedValue({ ocrTrainingOptIn: true });
    const r = await collectTrainingSample({ userId: "u1", bill, ocr });
    expect(r).not.toBeNull();
    expect(sampleCreate).toHaveBeenCalled();
    const data = (sampleCreate.mock.calls[0][0] as { data: { anonymizedJson: string } }).data;
    const parsed = JSON.parse(data.anonymizedJson) as { rawText: string; customerNumber?: string };
    expect(parsed.rawText).toContain("<NAME>");
    expect(parsed.rawText).not.toContain("12345678");
    expect(parsed).not.toHaveProperty("customerNumber");
  });

  it("opt-out user → no sample created", async () => {
    userFind.mockResolvedValue({ ocrTrainingOptIn: false });
    const r = await collectTrainingSample({ userId: "u1", bill, ocr });
    expect(r).toBeNull();
    expect(sampleCreate).not.toHaveBeenCalled();
  });

  it("user record missing → no sample created", async () => {
    userFind.mockResolvedValue(null);
    const r = await collectTrainingSample({ userId: "u1", bill, ocr });
    expect(r).toBeNull();
    expect(sampleCreate).not.toHaveBeenCalled();
  });
});
