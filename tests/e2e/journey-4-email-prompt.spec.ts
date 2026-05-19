/**
 * v16 DEEL 4 — Stap 4: anonymous email-prompt + magic-link dispatch.
 *
 * Validates the /api/anon/email-signup endpoint contract against
 * prod. We don't trigger an actual magic-link send here (that
 * burns Resend free-tier quota and pollutes the test mailbox);
 * NextAuth's signIn() call is mocked or sidestepped in the
 * component layer. The contract gate covers:
 *
 *   - Honeypot filled → 400 silent reject.
 *   - Submit < 2s after render → 400 too-fast.
 *   - Bot User-Agent (curl/python/headless) → 400 reject.
 *   - Invalid email → 400 invalid email.
 *   - Per-IP rate-limit caps at 5/h → 429 on 6th.
 *   - Valid payload from a real-looking browser → 200 ok.
 *
 * All checks use unique fake X-Forwarded-For values so the prod
 * rate-limit bucket isn't poisoned for legit visitors.
 */
import { test, expect } from "@playwright/test";

function fakeIp(): string {
  return `198.51.100.${1 + Math.floor(Math.random() * 250)}`;
}

const REAL_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

test.describe("v16 journey-4 — email-prompt anti-bot bundle", () => {
  test("honeypot filled → 400 rejected", async ({ request }) => {
    const r = await request.post("/api/anon/email-signup", {
      headers: { "x-forwarded-for": fakeIp(), "user-agent": REAL_UA },
      data: {
        email: "real@example.com",
        billId: "bill_abc",
        hp: "I am a bot",
        renderedAt: Date.now() - 5000,
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/honeypot/);
  });

  test("submitted < 2s after render → 400 too-fast", async ({ request }) => {
    const r = await request.post("/api/anon/email-signup", {
      headers: { "x-forwarded-for": fakeIp(), "user-agent": REAL_UA },
      data: {
        email: "real@example.com",
        billId: "bill_abc",
        hp: "",
        renderedAt: Date.now() - 500, // 0.5s ago
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.error).toMatch(/too-fast/);
  });

  test("curl User-Agent → 400 reject", async ({ request }) => {
    const r = await request.post("/api/anon/email-signup", {
      headers: { "x-forwarded-for": fakeIp(), "user-agent": "curl/8.6.0" },
      data: {
        email: "real@example.com",
        billId: "bill_abc",
        hp: "",
        renderedAt: Date.now() - 5000,
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.error).toMatch(/user-agent/);
  });

  test("python-requests UA → 400 reject", async ({ request }) => {
    const r = await request.post("/api/anon/email-signup", {
      headers: {
        "x-forwarded-for": fakeIp(),
        "user-agent": "python-requests/2.31.0",
      },
      data: {
        email: "real@example.com",
        billId: "bill_abc",
        hp: "",
        renderedAt: Date.now() - 5000,
      },
    });
    expect(r.status()).toBe(400);
  });

  test("invalid email → 400", async ({ request }) => {
    const r = await request.post("/api/anon/email-signup", {
      headers: { "x-forwarded-for": fakeIp(), "user-agent": REAL_UA },
      data: {
        email: "not-an-email",
        billId: "bill_abc",
        hp: "",
        renderedAt: Date.now() - 5000,
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.error).toMatch(/email/);
  });

  test("missing billId → 400", async ({ request }) => {
    const r = await request.post("/api/anon/email-signup", {
      headers: { "x-forwarded-for": fakeIp(), "user-agent": REAL_UA },
      data: {
        email: "real@example.com",
        hp: "",
        renderedAt: Date.now() - 5000,
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.error).toMatch(/bill/);
  });

  test("valid payload → 200 ok", async ({ request }) => {
    const r = await request.post("/api/anon/email-signup", {
      headers: { "x-forwarded-for": fakeIp(), "user-agent": REAL_UA },
      data: {
        email: "v16-journey-test@degeldheld-test.com",
        billId: "bill_synthetic_for_test",
        hp: "",
        renderedAt: Date.now() - 5000,
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
  });

  test("6th submission from same IP within 1h → 429", async ({ request }) => {
    const ip = fakeIp();
    const headers = { "x-forwarded-for": ip, "user-agent": REAL_UA };
    for (let i = 0; i < 5; i++) {
      const r = await request.post("/api/anon/email-signup", {
        headers,
        data: {
          email: `v16-test-${i}@degeldheld-test.com`,
          billId: "bill_x",
          hp: "",
          renderedAt: Date.now() - 5000,
        },
      });
      expect([200, 429], `attempt ${i + 1}`).toContain(r.status());
    }
    const r6 = await request.post("/api/anon/email-signup", {
      headers,
      data: {
        email: "v16-test-6@degeldheld-test.com",
        billId: "bill_x",
        hp: "",
        renderedAt: Date.now() - 5000,
      },
    });
    expect(r6.status()).toBe(429);
  });

  test("AnonymousMailPrompt is rendered + wires signIn via lib/auth", () => {
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const src = readFileSync(
      resolve(__dirname, "../../components/AnonymousMailPrompt.tsx"),
      "utf8",
    );
    // Source-level: the component still posts to /api/anon/email-signup
    // and then calls signIn("resend") with the callbackUrl pointing at
    // the post-signup destination.
    expect(src).toMatch(/\/api\/anon\/email-signup/);
    expect(src).toMatch(/signIn\(\s*"resend"/);
    expect(src).toMatch(/\/onderhandel\/email\?bill=/);
  });
});
