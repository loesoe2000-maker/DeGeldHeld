import { describe, it, expect, afterEach } from "vitest";
import { verifyTurnstileToken, __setFetchImpl, TURNSTILE_VERIFY_URL } from "@/lib/turnstile";

const originalSecret = process.env.TURNSTILE_SECRET_KEY;

afterEach(() => {
  process.env.TURNSTILE_SECRET_KEY = originalSecret;
  __setFetchImpl(null);
});

describe("verifyTurnstileToken — Cloudflare API contract (v15 DEEL 5)", () => {
  it("posts to challenges.cloudflare.com/turnstile/v0/siteverify", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sk_test";
    let calledUrl = "";
    __setFetchImpl(async (url) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    await verifyTurnstileToken("good-token");
    expect(calledUrl).toBe(TURNSTILE_VERIFY_URL);
  });

  it("sends secret + token as form-urlencoded", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sk_test_secret_xyz";
    let bodyText = "";
    let contentType = "";
    __setFetchImpl(async (_url, init) => {
      bodyText = String(init?.body ?? "");
      contentType = String(
        (init?.headers as Record<string, string> | undefined)?.["content-type"] ?? "",
      );
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    await verifyTurnstileToken("user-token-abc", "1.2.3.4");
    expect(contentType).toMatch(/x-www-form-urlencoded/);
    expect(bodyText).toContain("secret=sk_test_secret_xyz");
    expect(bodyText).toContain("response=user-token-abc");
    expect(bodyText).toContain("remoteip=1.2.3.4");
  });

  it("HTTP non-2xx → ok=false with http reason", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sk_test";
    __setFetchImpl(async () =>
      new Response("server down", { status: 503 }),
    );
    const v = await verifyTurnstileToken("good-token");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/http 503/);
  });

  it("malformed JSON response → ok=false with bad json", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sk_test";
    __setFetchImpl(async () =>
      new Response("not json at all", { status: 200 }),
    );
    const v = await verifyTurnstileToken("good-token");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/bad json/);
  });
});
