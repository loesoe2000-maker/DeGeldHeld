/**
 * Unified error handling voor API routes:
 *  - mapError() vertaalt JS errors naar user-friendly NL messages
 *  - withErrorHandler() wraps async handlers met try/catch + Sentry pickup
 *  - retryWithBackoff() exponential backoff retry voor transient errors
 */

import { NextResponse } from "next/server";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "OCR_FAILED"
  | "LLM_FAILED"
  | "STRIPE_FAILED"
  | "DB_FAILED"
  | "EMAIL_FAILED"
  | "NETWORK"
  | "UNKNOWN";

export const ERROR_MESSAGES_NL: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Je bent niet ingelogd — log opnieuw in.",
  VALIDATION: "Sommige velden zijn niet correct ingevuld.",
  RATE_LIMIT: "Te veel aanvragen. Probeer over een minuut opnieuw.",
  OCR_FAILED: "We konden je rekening niet automatisch uitlezen. Vul handmatig in.",
  LLM_FAILED: "Onze AI-assistent is even niet beschikbaar. Probeer opnieuw.",
  STRIPE_FAILED: "Betaling kon niet worden verwerkt. Probeer opnieuw of contact support.",
  DB_FAILED: "Tijdelijk probleem aan onze kant. Probeer over een minuut opnieuw.",
  EMAIL_FAILED: "We konden de e-mail niet versturen. Controleer je e-mailadres.",
  NETWORK: "Verbindingsprobleem. Controleer je internet.",
  UNKNOWN: "Er ging iets onverwachts mis. Probeer opnieuw.",
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  cause?: unknown;
  constructor(code: ErrorCode, status = 500, cause?: unknown) {
    super(ERROR_MESSAGES_NL[code]);
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export function mapError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  if (/unauthor|401/.test(msg)) return new AppError("UNAUTHORIZED", 401, e);
  if (/rate|429|too many/.test(msg)) return new AppError("RATE_LIMIT", 429, e);
  if (/validation|zod|invalid/.test(msg)) return new AppError("VALIDATION", 400, e);
  if (/stripe/.test(msg)) return new AppError("STRIPE_FAILED", 502, e);
  if (/groq|llm|openai/.test(msg)) return new AppError("LLM_FAILED", 502, e);
  if (/ocr|vision/.test(msg)) return new AppError("OCR_FAILED", 502, e);
  if (/prisma|database|db|p20|p10/.test(msg)) return new AppError("DB_FAILED", 500, e);
  if (/email|resend|smtp/.test(msg)) return new AppError("EMAIL_FAILED", 502, e);
  if (/network|econn|enot|timeout|503|502|504/.test(msg)) return new AppError("NETWORK", 503, e);
  return new AppError("UNKNOWN", 500, e);
}

export function errorResponse(err: unknown) {
  const app = mapError(err);
  return NextResponse.json(
    {
      error: app.message,
      code: app.code,
    },
    { status: app.status },
  );
}

/**
 * Wraps an async route handler. On throw: map → user-friendly JSON response.
 * Adds Sentry context tag via global Sentry shim if available (no-op otherwise).
 */
export function withErrorHandler<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
  context?: { route?: string },
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (e) {
      const app = mapError(e);
      // Sentry context tag pickup (best-effort, no-throw)
      try {
        const sentry = (globalThis as { Sentry?: { setContext?: (n: string, c: unknown) => void } }).Sentry;
        if (sentry?.setContext) {
          sentry.setContext("api_route", {
            route: context?.route,
            errorCode: app.code,
          });
        }
      } catch {
        // ignore
      }
      return errorResponse(app) as TResult;
    }
  };
}

const TRANSIENT_RE = /429|503|502|504|timeout|econn|enot|aborted/;

export function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return TRANSIENT_RE.test(msg);
}

/**
 * Exponential backoff retry. Default: 1 retry after 1.5s, only on transient errors.
 * For non-transient errors → throw immediately (no waste of time).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 1;
  const base = opts.baseDelayMs ?? 1500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries) throw e;
      if (!isTransient(e)) throw e;
      const delay = base * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
