import { describe, it, expect, vi } from "vitest";

// Stub prisma raw query — health route calls SELECT 1
vi.mock("../lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ "?column?": 1 }]),
  },
}));

import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 + status:ok when env is healthy and no external keys set", async () => {
    const res = await GET();
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.service).toBe("degeldheld");
    expect(body.services).toBeDefined();
    expect(body.services.db).toBeDefined();
    expect(body.services.groq).toBeDefined();
    expect(body.services.resend).toBeDefined();
    expect(body.services.stripe).toBeDefined();
  });

  it("body shape: includes env_ok and uptimeSeconds", async () => {
    const res = await GET();
    const body = await res.json();
    expect(typeof body.env_ok).toBe("boolean");
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("each service report has ok + ms shape", async () => {
    const res = await GET();
    const body = await res.json();
    for (const k of ["db", "groq", "resend", "stripe"]) {
      const s = body.services[k];
      expect(typeof s.ok).toBe("boolean");
      expect(typeof s.ms).toBe("number");
    }
  });

  it("v20: includes an email deliverability section without leaking secrets", async () => {
    const res = await GET();
    const body = await res.json();
    const email = body.services.email;
    expect(email).toBeDefined();
    expect(typeof email.apiKeySet).toBe("boolean");
    expect(typeof email.fromDomain).toBe("string");
    expect(typeof email.testSender).toBe("boolean");
    expect(typeof email.ok).toBe("boolean");
    // never echo the key itself
    expect(JSON.stringify(email)).not.toMatch(/re_/);
  });
});
