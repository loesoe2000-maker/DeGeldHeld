import { describe, it, expect } from "vitest";
import { isDueForRecheck, RECHECK_WINDOW_DAYS } from "@/lib/recheck-savings";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-05-18T09:30:00Z");

function ago(days: number): Date {
  return new Date(now.getTime() - days * DAY);
}

describe("recheck-savings / isDueForRecheck", () => {
  it("EMAIL_SENT 30 days ago → due", () => {
    expect(
      isDueForRecheck(
        {
          state: "EMAIL_SENT",
          emailSentAt: ago(30),
          proofVerifiedAt: null,
          closedAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("EMAIL_SENT 28 days ago (lower boundary) → due", () => {
    expect(
      isDueForRecheck(
        {
          state: "EMAIL_SENT",
          emailSentAt: ago(RECHECK_WINDOW_DAYS.min),
          proofVerifiedAt: null,
          closedAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("EMAIL_SENT 35 days ago (upper boundary) → due", () => {
    expect(
      isDueForRecheck(
        {
          state: "EMAIL_SENT",
          emailSentAt: ago(RECHECK_WINDOW_DAYS.max),
          proofVerifiedAt: null,
          closedAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("EMAIL_SENT 27 days ago → too early", () => {
    expect(
      isDueForRecheck(
        {
          state: "EMAIL_SENT",
          emailSentAt: ago(27),
          proofVerifiedAt: null,
          closedAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("EMAIL_SENT 36 days ago → expired window", () => {
    expect(
      isDueForRecheck(
        {
          state: "EMAIL_SENT",
          emailSentAt: ago(36),
          proofVerifiedAt: null,
          closedAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("already-verified proof → never due", () => {
    expect(
      isDueForRecheck(
        {
          state: "SUCCESS_UNVERIFIED",
          emailSentAt: ago(30),
          proofVerifiedAt: ago(2),
          closedAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("NIEUW state is never due (no email sent yet)", () => {
    expect(
      isDueForRecheck(
        {
          state: "NIEUW",
          emailSentAt: ago(30),
          proofVerifiedAt: null,
          closedAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("falls back to closedAt when emailSentAt is null", () => {
    expect(
      isDueForRecheck(
        {
          state: "SUCCESS_UNVERIFIED",
          emailSentAt: null,
          proofVerifiedAt: null,
          closedAt: ago(30),
        },
        now,
      ),
    ).toBe(true);
  });
});
