import { describe, it, expect, afterEach } from "vitest";
import {
  verifyTurnstileToken,
  __setFetchImpl,
} from "@/lib/turnstile";

const originalSecret = process.env.TURNSTILE_SECRET_KEY;

afterEach(() => {
  process.env.TURNSTILE_SECRET_KEY = originalSecret;
  __setFetchImpl(null);
});

describe("Turnstile graceful fallback (user spec)", () => {
  it("without TURNSTILE_SECRET_KEY → ok=true, skipped=true (no flow blocked)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const v = await verifyTurnstileToken("anything");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.skipped).toBe(true);
  });

  it("with secret + missing token → fails fast", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const v = await verifyTurnstileToken(null);
    expect(v.ok).toBe(false);
  });

  it("with secret + Cloudflare success → ok=true", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    __setFetchImpl(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const v = await verifyTurnstileToken("good-token");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.skipped).toBeUndefined();
  });

  it("with secret + Cloudflare reject → ok=false with reason", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    __setFetchImpl(async () =>
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-token"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const v = await verifyTurnstileToken("bad-token");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/invalid-token/);
  });

  it("network failure → ok=false (never throws)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    __setFetchImpl(async () => {
      throw new Error("ECONNREFUSED");
    });
    const v = await verifyTurnstileToken("good-token");
    expect(v.ok).toBe(false);
  });
});
