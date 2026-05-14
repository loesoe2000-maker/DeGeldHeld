import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// Stub env vars used by lib modules during tests.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/degeldheld_test";
process.env.NEXTAUTH_SECRET ??= "test-secret-not-for-production-use-only";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
process.env.RESEND_API_KEY ??= "re_test_dummy";
process.env.GROQ_API_KEY ??= "gsk_test_dummy";
process.env.STRIPE_SECRET_KEY ??= "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_test_dummy";
process.env.SENTRY_DSN ??= "";
process.env.EMAIL_FROM ??= "onboarding@degeldheld.com";

// Stub fetch globally — individual tests can override via vi.stubGlobal.
if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
}
