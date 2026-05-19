import { describe, it, expect, beforeEach } from "vitest";
import { __resetRateLimit } from "@/lib/rate-limit";

const ROUTE = "@/app/api/anon/email-signup/route";

function mockReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://test.example/api/anon/email-signup", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("/api/anon/email-signup — anti-bot + email validation", () => {
  beforeEach(() => __resetRateLimit());

  it("honeypot filled → 400 rejected", async () => {
    const { POST } = await import(ROUTE);
    const r = await POST(
      mockReq({
        email: "real@user.com",
        billId: "b",
        hp: "I am a bot",
        renderedAt: Date.now() - 5000,
      }),
    );
    expect(r.status).toBe(400);
  });

  it("submitted too fast (< 2s) → 400", async () => {
    const { POST } = await import(ROUTE);
    const r = await POST(
      mockReq({
        email: "real@user.com",
        billId: "b",
        hp: "",
        renderedAt: Date.now(), // 0ms ago
      }),
    );
    expect(r.status).toBe(400);
  });

  it("invalid email → 400", async () => {
    const { POST } = await import(ROUTE);
    const r = await POST(
      mockReq({
        email: "not-an-email",
        billId: "b",
        hp: "",
        renderedAt: Date.now() - 5000,
      }),
    );
    expect(r.status).toBe(400);
  });

  it("missing billId → 400", async () => {
    const { POST } = await import(ROUTE);
    const r = await POST(
      mockReq({
        email: "real@user.com",
        hp: "",
        renderedAt: Date.now() - 5000,
      }),
    );
    expect(r.status).toBe(400);
  });

  it("valid submission → 200 ok", async () => {
    const { POST } = await import(ROUTE);
    const r = await POST(
      mockReq(
        {
          email: "real@user.com",
          billId: "b",
          hp: "",
          renderedAt: Date.now() - 5000,
        },
        { "x-forwarded-for": "1.2.3.4" },
      ),
    );
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
  });

  it("6th submission from same IP within 1h → 429", async () => {
    const { POST } = await import(ROUTE);
    const headers = { "x-forwarded-for": "5.5.5.5" };
    for (let i = 0; i < 5; i++) {
      await POST(
        mockReq(
          {
            email: `u${i}@example.com`,
            billId: "b",
            hp: "",
            renderedAt: Date.now() - 5000,
          },
          headers,
        ),
      );
    }
    const r6 = await POST(
      mockReq(
        {
          email: "u6@example.com",
          billId: "b",
          hp: "",
          renderedAt: Date.now() - 5000,
        },
        headers,
      ),
    );
    expect(r6.status).toBe(429);
  });

  it("invalid JSON → 400", async () => {
    const { POST } = await import(ROUTE);
    const r = await POST(
      new Request("https://test.example/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(r.status).toBe(400);
  });
});
