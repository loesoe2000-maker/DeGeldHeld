import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pure-logic test of the outcome-followup cron selection criteria.
 *
 * We can't easily spin up a real DB in unit tests, so we mock Prisma and
 * assert the cron route requests negotiations matching exactly:
 *   - emailSentAt <= 7d ago
 *   - outcomeAskedAt IS NULL
 *   - state ∈ EMAIL_GEN | EMAIL_SENT | AWAITING | COUNTER_SENT | RESPONSE_RECEIVED
 *   - closedAt IS NULL
 * with a 50-row cap.
 */

const findManyMock = vi.fn();
const updateMock = vi.fn();
const sendEmailMock = vi.fn();
const cronCreateMock = vi.fn(async (_a: unknown) => ({ id: "lock-1" }));
const cronUpdateMock = vi.fn(async (_a: unknown) => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    cronRunLog: {
      create: (a: unknown) => cronCreateMock(a),
      update: (a: unknown) => cronUpdateMock(a),
    },
  },
}));

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...actual,
    sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  };
});

beforeEach(() => {
  findManyMock.mockReset();
  updateMock.mockReset();
  sendEmailMock.mockReset();
  cronCreateMock.mockReset().mockResolvedValue({ id: "lock-1" });
  cronUpdateMock.mockReset().mockResolvedValue({});
  process.env.OUTCOME_TOKEN_SECRET = "test-secret-32-bytes-or-more-pls-ok";
  process.env.CRON_SECRET = "test-cron";
  process.env.APP_URL = "https://test.app";
});

async function callCron(authHeader?: string) {
  const { GET } = await import("@/app/api/cron/outcome-followup/route");
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  const req = new Request("https://test.app/api/cron/outcome-followup", { headers });
  // Next.js Request → NextRequest cast at runtime via App Router
  return GET(req as unknown as Parameters<typeof GET>[0]);
}

describe("cron/outcome-followup", () => {
  it("rejects unauthenticated requests when CRON_SECRET set", async () => {
    const resp = await callCron();
    expect(resp.status).toBe(401);
  });

  it("uses correct selection criteria", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await callCron("Bearer test-cron");

    expect(findManyMock).toHaveBeenCalledOnce();
    const where = findManyMock.mock.calls[0][0].where;
    expect(where.outcomeAskedAt).toBeNull();
    expect(where.closedAt).toBeNull();
    expect(where.emailSentAt.lte).toBeInstanceOf(Date);
    const cutoff = where.emailSentAt.lte as Date;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
    expect(where.state.in).toEqual([
      "EMAIL_GEN",
      "EMAIL_SENT",
      "AWAITING",
      "COUNTER_SENT",
      "RESPONSE_RECEIVED",
    ]);
  });

  it("caps at 50 per run", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await callCron("Bearer test-cron");
    expect(findManyMock.mock.calls[0][0].take).toBe(50);
  });

  it("sends mail and marks outcomeAskedAt for each due", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "neg1",
        expectedSavingsCents: 5000,
        user: { email: "a@b.nl", name: "A" },
        bill: { id: "bill1", provider: "KPN" },
      },
      {
        id: "neg2",
        expectedSavingsCents: 0,
        user: { email: "c@d.nl", name: null },
        bill: { id: "bill2", provider: "Vodafone" },
      },
    ]);
    sendEmailMock.mockResolvedValue({ ok: true });
    updateMock.mockResolvedValue({});

    const resp = await callCron("Bearer test-cron");
    const data = (await resp.json()) as { sent: number; failed: number };
    expect(data.sent).toBe(2);
    expect(data.failed).toBe(0);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.calls[0][0].data.outcomeAskedAt).toBeInstanceOf(Date);
  });

  it("counts failures separately", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "neg1",
        expectedSavingsCents: 0,
        user: { email: "a@b.nl", name: null },
        bill: { id: "bill1", provider: "KPN" },
      },
    ]);
    sendEmailMock.mockRejectedValueOnce(new Error("resend down"));
    const resp = await callCron("Bearer test-cron");
    const data = (await resp.json()) as { sent: number; failed: number };
    expect(data.sent).toBe(0);
    expect(data.failed).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
