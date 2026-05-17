import { NextResponse } from "next/server";
import { envHealth } from "@/lib/env";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ServiceCheck = { ok: boolean; ms: number; note?: string };

// In-memory cache for slow external pings (Groq, Resend). 5-min TTL prevents
// /api/health itself from becoming an external-quota burner.
const cache = new Map<string, { value: ServiceCheck; at: number }>();
const TTL_MS = 5 * 60 * 1000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function checkDb(): Promise<ServiceCheck> {
  const t = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2_000);
    return { ok: true, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, note: (e as Error).message };
  }
}

function cached(key: string, fn: () => Promise<ServiceCheck>): Promise<ServiceCheck> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL_MS) return Promise.resolve(c.value);
  return fn().then((v) => {
    cache.set(key, { value: v, at: Date.now() });
    return v;
  });
}

async function checkGroq(): Promise<ServiceCheck> {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === "gsk_test_dummy") return { ok: true, ms: 0, note: "skip-no-key" };
  const t = Date.now();
  try {
    const r = await withTimeout(
      fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${key}` } }),
      3_000,
    );
    return { ok: r.ok, ms: Date.now() - t, note: r.ok ? undefined : `http ${r.status}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, note: (e as Error).message };
  }
}

async function checkResend(): Promise<ServiceCheck> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: true, ms: 0, note: "skip-no-key" };
  const t = Date.now();
  try {
    const r = await withTimeout(
      fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${key}` } }),
      3_000,
    );
    return { ok: r.ok, ms: Date.now() - t, note: r.ok ? undefined : `http ${r.status}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, note: (e as Error).message };
  }
}

async function checkStripe(): Promise<ServiceCheck> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === "sk_test_dummy") return { ok: true, ms: 0, note: "skip-no-key" };
  const t = Date.now();
  try {
    const r = await withTimeout(
      fetch("https://api.stripe.com/v1/balance", { headers: { authorization: `Bearer ${key}` } }),
      3_000,
    );
    return { ok: r.ok, ms: Date.now() - t, note: r.ok ? undefined : `http ${r.status}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, note: (e as Error).message };
  }
}

export async function GET() {
  const env = envHealth();
  const [db, groq, resend, stripe] = await Promise.all([
    checkDb(),
    cached("groq", checkGroq),
    cached("resend", checkResend),
    cached("stripe", checkStripe),
  ]);
  const services = { db, groq, resend, stripe };
  const allOk = env.ok && db.ok && groq.ok && resend.ok && stripe.ok;
  const body = {
    status: allOk ? "ok" : "degraded",
    service: "degeldheld",
    timestamp: new Date().toISOString(),
    env_ok: env.ok,
    env_missing: env.missing,
    services,
    uptimeSeconds: Math.floor(process.uptime?.() ?? 0),
  };
  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
  });
}
