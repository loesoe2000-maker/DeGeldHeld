import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the prisma + email modules before importing the route.
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
vi.mock("../lib/db", () => ({
  prisma: {
    waitlistEntry: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

const mockSendEmail = vi.fn();
vi.mock("../lib/email", async () => {
  const actual = await vi.importActual<typeof import("../lib/email")>("../lib/email");
  return {
    ...actual,
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  };
});

import { POST } from "../app/api/waitlist/route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("api/waitlist POST", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ id: "test", skipped: false });
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await POST(makeReq("not-json{") as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/JSON/i);
  });

  it("rejects missing email with 400", async () => {
    const res = await POST(makeReq({}) as never);
    expect(res.status).toBe(400);
  });

  it("rejects malformed email with 400", async () => {
    const res = await POST(makeReq({ email: "not-an-email" }) as never);
    expect(res.status).toBe(400);
  });

  it("creates waitlist entry on first signup", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "x" });
    const res = await POST(makeReq({ email: "new@example.nl" }) as never);
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledOnce();
    const data = await res.json();
    expect(data.status).toBe("subscribed");
  });

  it("sends welcome email on first signup", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "x" });
    await POST(makeReq({ email: "new@example.nl" }) as never);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("returns already_subscribed for duplicate email", async () => {
    mockFindUnique.mockResolvedValue({ id: "exists" });
    const res = await POST(makeReq({ email: "old@example.nl" }) as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("already_subscribed");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not fail when email send rejects", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "x" });
    mockSendEmail.mockRejectedValue(new Error("resend down"));
    const res = await POST(makeReq({ email: "x@y.nl" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));
    const res = await POST(makeReq({ email: "x@y.nl" }) as never);
    expect(res.status).toBe(500);
  });
});
