/**
 * lib/anon-session.ts — v15 anonymous browser-session helpers.
 *
 * Anonymous visitors upload bills before they sign up. Each browser
 * gets a UUID cookie that ties their bills together until they
 * complete a magic-link signup, at which point the bills are
 * claimed under their User.id.
 */
import crypto from "crypto";

export const ANON_COOKIE_NAME = "dgh_anon_session";
export const ANON_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h

/** Generate a fresh anonymous session id (UUID v4). */
export function generateAnonSessionId(): string {
  return crypto.randomUUID();
}

/** Validate that a cookie value looks like a UUID — defensive against
 * forged cookies sneaking arbitrary strings into queries. */
export function isValidAnonSessionId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Cookie attributes used both at set + clear time. */
export const ANON_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
};
