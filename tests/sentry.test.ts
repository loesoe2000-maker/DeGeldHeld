import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("sentry instrumentation", () => {
  it("instrumentation.ts exists at project root", () => {
    const p = path.resolve(__dirname, "../instrumentation.ts");
    expect(fs.existsSync(p)).toBe(true);
  });

  it("sentry.server.config.ts initialises with DSN-gated init", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../sentry.server.config.ts"),
      "utf-8",
    );
    expect(src).toMatch(/Sentry\.init/);
    expect(src).toMatch(/process\.env\.SENTRY_DSN/);
  });

  it("client config enables session replay with privacy mask", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../sentry.client.config.ts"),
      "utf-8",
    );
    expect(src).toMatch(/replayIntegration/);
    expect(src).toMatch(/maskAllText:\s*true/);
    expect(src).toMatch(/blockAllMedia:\s*true/);
  });

  it("PII scrub: beforeSend strips cookies + authorization header", () => {
    const server = fs.readFileSync(path.resolve(__dirname, "../sentry.server.config.ts"), "utf-8");
    const client = fs.readFileSync(path.resolve(__dirname, "../sentry.client.config.ts"), "utf-8");
    expect(server).toMatch(/delete\s+event\.request\.cookies/);
    expect(server).toMatch(/delete\s+h\.cookie/);
    expect(server).toMatch(/delete\s+h\.authorization/);
    expect(client).toMatch(/delete\s+event\.request\.cookies/);
  });

  it("critical API routes capture exceptions to Sentry on 500", () => {
    const upload = fs.readFileSync(
      path.resolve(__dirname, "../app/api/bills/upload/route.ts"),
      "utf-8",
    );
    expect(upload).toMatch(/Sentry\.captureException/);
    expect(upload).toMatch(/tags:\s*\{[^}]*route:\s*"bills\/upload"/);
  });

  it("cron follow-up captures per-item failures", () => {
    const cron = fs.readFileSync(
      path.resolve(__dirname, "../app/api/cron/follow-up/route.ts"),
      "utf-8",
    );
    expect(cron).toMatch(/Sentry\.captureException/);
  });
});

describe("/api/test-sentry route", () => {
  beforeEach(() => {
    process.env.SENTRY_ENVIRONMENT = "development";
    process.env.CRON_SECRET = "test-cron";
  });

  it("without ?fire=1 reports config status without throwing (200)", async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const captureMock = vi.fn((_e?: unknown, _o?: unknown) => "evt-1");
    vi.doMock("@sentry/nextjs", () => ({
      captureException: (e: unknown, opts: unknown) => captureMock(e, opts),
      flush: async () => true,
      getClient: () => undefined,
    }));
    vi.resetModules();
    const mod = await import("../app/api/test-sentry/route");
    const res = await mod.GET(new Request("https://t/test-sentry"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.configured).toBe(false);
    expect(captureMock).not.toHaveBeenCalled();
    vi.doUnmock("@sentry/nextjs");
  });

  it("with ?fire=1 throws a tagged test error (500) and reports configured", async () => {
    process.env.SENTRY_DSN = "https://pub@o1.ingest.sentry.io/1";
    const captureMock = vi.fn((_e?: unknown, _o?: unknown) => "evt-1");
    vi.doMock("@sentry/nextjs", () => ({
      captureException: (e: unknown, opts: unknown) => captureMock(e, opts),
      flush: async () => true,
      getClient: () => undefined,
    }));
    vi.resetModules();
    const mod = await import("../app/api/test-sentry/route");
    const res = await mod.GET(new Request("https://t/test-sentry?fire=1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.eventId).toBe("evt-1");
    expect(body.ok).toBe(false);
    expect(body.configured).toBe(true);
    // tagged { test: true } so the dashboard filter is unambiguous
    expect(captureMock.mock.calls[0]?.[1]).toMatchObject({ tags: { test: true } });
    delete process.env.SENTRY_DSN;
    vi.doUnmock("@sentry/nextjs");
  });

  it("forbids without secret in production", async () => {
    process.env.SENTRY_ENVIRONMENT = "production";
    const captureMock = vi.fn((_e?: unknown, _o?: unknown) => "evt-2");
    vi.doMock("@sentry/nextjs", () => ({
      captureException: (e: unknown, opts: unknown) => captureMock(e, opts),
      flush: async () => true,
      getClient: () => undefined,
    }));
    // Re-import to pick up the changed env
    vi.resetModules();
    const mod = await import("../app/api/test-sentry/route");
    const res = await mod.GET(new Request("https://t/test-sentry?fire=1"));
    expect(res.status).toBe(403);
    vi.doUnmock("@sentry/nextjs");
  });

  it("allows production access with Bearer CRON_SECRET", async () => {
    process.env.SENTRY_ENVIRONMENT = "production";
    vi.doMock("@sentry/nextjs", () => ({
      captureException: () => "evt-3",
      flush: async () => true,
      getClient: () => undefined,
    }));
    vi.resetModules();
    const mod = await import("../app/api/test-sentry/route");
    const res = await mod.GET(
      new Request("https://t/test-sentry?fire=1", {
        headers: { authorization: "Bearer test-cron" },
      }),
    );
    expect(res.status).toBe(500);
    vi.doUnmock("@sentry/nextjs");
  });
});
