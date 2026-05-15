import { describe, it, expect, vi } from "vitest";
import {
  AppError,
  ERROR_MESSAGES_NL,
  errorResponse,
  isTransient,
  mapError,
  retryWithBackoff,
  withErrorHandler,
} from "../lib/errors";

describe("errors/mapError", () => {
  it("preserves AppError as-is", () => {
    const e = new AppError("RATE_LIMIT", 429);
    expect(mapError(e)).toBe(e);
  });

  it("maps 401 to UNAUTHORIZED", () => {
    expect(mapError(new Error("Unauthorized — 401")).code).toBe("UNAUTHORIZED");
  });

  it("maps rate-limit to RATE_LIMIT", () => {
    expect(mapError(new Error("429 Too Many Requests")).code).toBe("RATE_LIMIT");
  });

  it("maps validation to VALIDATION", () => {
    expect(mapError(new Error("ZodError: invalid")).code).toBe("VALIDATION");
  });

  it("maps stripe-related to STRIPE_FAILED", () => {
    expect(mapError(new Error("stripe checkout failed")).code).toBe("STRIPE_FAILED");
  });

  it("maps groq/llm to LLM_FAILED", () => {
    expect(mapError(new Error("Groq endpoint timeout")).code).toBe("LLM_FAILED");
  });

  it("maps vision/ocr to OCR_FAILED", () => {
    expect(mapError(new Error("vision model returned bogus")).code).toBe("OCR_FAILED");
  });

  it("maps prisma to DB_FAILED", () => {
    expect(mapError(new Error("Prisma P2002 unique violation")).code).toBe("DB_FAILED");
  });

  it("maps network errors to NETWORK", () => {
    expect(mapError(new Error("ECONNREFUSED")).code).toBe("NETWORK");
  });

  it("falls back to UNKNOWN", () => {
    expect(mapError(new Error("random thing")).code).toBe("UNKNOWN");
  });

  it("handles non-Error throws (string)", () => {
    expect(mapError("not an error").code).toBe("UNKNOWN");
  });
});

describe("errors/messages NL", () => {
  it("ERROR_MESSAGES_NL has entries for all codes", () => {
    expect(ERROR_MESSAGES_NL.UNAUTHORIZED).toMatch(/ingelogd|opnieuw/i);
    expect(ERROR_MESSAGES_NL.RATE_LIMIT).toMatch(/aanvragen|minuut/i);
    expect(ERROR_MESSAGES_NL.OCR_FAILED).toMatch(/rekening|handmatig/i);
  });

  it("messages are Dutch (no English stack-trace style)", () => {
    for (const [, msg] of Object.entries(ERROR_MESSAGES_NL)) {
      expect(msg).not.toMatch(/error|stack|null|undefined/i);
    }
  });
});

describe("errors/errorResponse", () => {
  it("returns NextResponse JSON with code + message", async () => {
    const r = errorResponse(new AppError("RATE_LIMIT", 429));
    const data = await r.json();
    expect(data.code).toBe("RATE_LIMIT");
    expect(data.error).toBe(ERROR_MESSAGES_NL.RATE_LIMIT);
    expect(r.status).toBe(429);
  });

  it("default status 500 for UNKNOWN", async () => {
    const r = errorResponse(new Error("random"));
    expect(r.status).toBe(500);
  });
});

describe("errors/isTransient", () => {
  it("treats 5xx + timeouts as transient", () => {
    expect(isTransient(new Error("503"))).toBe(true);
    expect(isTransient(new Error("Request timeout"))).toBe(true);
    expect(isTransient(new Error("ECONNRESET"))).toBe(true);
  });

  it("treats validation/auth as NOT transient", () => {
    expect(isTransient(new Error("Validation failed"))).toBe(false);
    expect(isTransient(new Error("Unauthorized"))).toBe(false);
  });
});

describe("errors/retryWithBackoff", () => {
  it("returns value on first success", async () => {
    let n = 0;
    const r = await retryWithBackoff(async () => {
      n++;
      return "ok";
    });
    expect(r).toBe("ok");
    expect(n).toBe(1);
  });

  it("retries once on transient error then succeeds", async () => {
    let n = 0;
    const r = await retryWithBackoff(
      async () => {
        n++;
        if (n === 1) throw new Error("503");
        return "ok";
      },
      { retries: 1, baseDelayMs: 10 },
    );
    expect(r).toBe("ok");
    expect(n).toBe(2);
  });

  it("does NOT retry non-transient errors", async () => {
    let n = 0;
    await expect(
      retryWithBackoff(
        async () => {
          n++;
          throw new Error("Validation failed");
        },
        { retries: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow(/Validation/);
    expect(n).toBe(1);
  });

  it("gives up after retries exhausted", async () => {
    let n = 0;
    await expect(
      retryWithBackoff(
        async () => {
          n++;
          throw new Error("503");
        },
        { retries: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow(/503/);
    expect(n).toBe(3); // 1 initial + 2 retries
  });
});

describe("errors/withErrorHandler", () => {
  it("returns handler result on success", async () => {
    const wrapped = withErrorHandler(async () => ({ ok: true }));
    const r = await wrapped();
    expect(r).toEqual({ ok: true });
  });

  it("catches throws and returns errorResponse", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new AppError("UNAUTHORIZED", 401);
    });
    const r = (await wrapped()) as unknown as Response;
    const data = await r.json();
    expect(data.code).toBe("UNAUTHORIZED");
    expect(r.status).toBe(401);
  });

  it("invokes Sentry.setContext if present", async () => {
    const setContext = vi.fn();
    (globalThis as { Sentry?: { setContext?: typeof setContext } }).Sentry = { setContext };
    const wrapped = withErrorHandler(
      async () => {
        throw new Error("Groq down");
      },
      { route: "/api/test" },
    );
    await wrapped();
    expect(setContext).toHaveBeenCalled();
    const [name, ctx] = setContext.mock.calls[0];
    expect(name).toBe("api_route");
    expect((ctx as { route: string }).route).toBe("/api/test");
    delete (globalThis as { Sentry?: unknown }).Sentry;
  });
});
