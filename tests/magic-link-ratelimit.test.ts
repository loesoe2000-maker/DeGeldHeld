import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { __resetRateLimit } from "@/lib/rate-limit";

/**
 * The magic-link send (`POST /api/auth/signin/resend`) is wrapped with a
 * per-IP rate-limit + bot-UA reject so the public login can't email-bomb
 * arbitrary inboxes or burn the Resend free-tier quota. We mock @/lib/auth
 * so the test exercises only the gate — handlers.POST stands in for NextAuth
 * and returns the same `{ url }` shape Auth.js does on a real send.
 */
vi.mock("@/lib/auth", () => ({
  handlers: {
    GET: vi.fn(async () => new Response("get-ok", { status: 200 })),
    POST: vi.fn(
      async () =>
        new Response(
          JSON.stringify({ url: "https://degeldheld.com/login?check=email" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ),
  },
}));

// Imported after the mock is registered (vi.mock is hoisted); this is the same
// mock object the route imports, so call assertions reflect what the route did.
import { handlers } from "@/lib/auth";

const REAL_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function authReq(
  ip: string,
  ua: string = REAL_UA,
  path = "/api/auth/signin/resend",
): NextRequest {
  return new Request(`https://degeldheld.com${path}`, {
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
      "user-agent": ua,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      email: "real@user.com",
      csrfToken: "x",
      callbackUrl: "/dashboard",
    }).toString(),
  }) as unknown as NextRequest;
}

describe("magic-link send gate — /api/auth/signin/resend", () => {
  beforeEach(() => {
    __resetRateLimit();
    vi.clearAllMocks();
  });

  it("lets a normal browser send through to NextAuth (under the limit)", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    const res = await POST(authReq("11.0.0.1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("check=email");
    expect(handlers.POST).toHaveBeenCalledTimes(1);
  });

  it("rate-limits the 6th send from the same IP within the window (429)", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    const ip = "11.0.0.2";
    for (let i = 0; i < 5; i++) {
      const r = await POST(authReq(ip));
      expect(r.status).toBe(200);
    }
    const r6 = await POST(authReq(ip));
    expect(r6.status).toBe(429);
    const data = await r6.json();
    expect(data.error).toBe("rate_limited");
    expect(data.url).toContain("/login?error=rate_limited");
    expect(r6.headers.get("retry-after")).toBeTruthy();
    // The blocked send never reached NextAuth.
    expect(handlers.POST).toHaveBeenCalledTimes(5);
  });

  it("does not leak the rate-limit bucket across IPs", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    for (let i = 0; i < 5; i++) await POST(authReq("11.0.0.3"));
    const other = await POST(authReq("11.0.0.4"));
    expect(other.status).toBe(200);
  });

  it("rejects obvious bot User-Agents outright (403, no send)", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    const res = await POST(authReq("11.0.0.5", "curl/8.6.0"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("blocked");
    expect(data.url).toContain("/login?error=blocked");
    expect(handlers.POST).not.toHaveBeenCalled();
  });

  it("does NOT gate other auth endpoints (e.g. signout)", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    // Even a bot UA hammering a non-send endpoint passes straight through.
    for (let i = 0; i < 8; i++) {
      const r = await POST(authReq("11.0.0.6", "curl/8.6.0", "/api/auth/signout"));
      expect(r.status).toBe(200);
    }
    expect(handlers.POST).toHaveBeenCalledTimes(8);
  });

  it("does not gate GET (magic-link verification)", async () => {
    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    const req = new Request(
      "https://degeldheld.com/api/auth/callback/resend?token=abc",
      { method: "GET" },
    ) as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(handlers.GET).toHaveBeenCalledTimes(1);
  });
});
