import { NextResponse } from "next/server";
import { envHealth } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const env = envHealth();
  const body = {
    status: env.ok ? "ok" : "degraded",
    service: "degeldheld",
    timestamp: new Date().toISOString(),
    env_ok: env.ok,
    env_missing: env.missing,
  };
  return NextResponse.json(body, {
    status: env.ok ? 200 : 503,
    headers: {
      // tiny TTL so a healthy box doesn't get hammered, but stale-revalidate keeps it fresh
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
    },
  });
}
