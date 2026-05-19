/**
 * POST /api/anon/email-signup — v15 DEEL 2 server-side anti-bot gate
 * for the AnonymousMailPrompt component.
 *
 * Validates honeypot + minimum time-to-submit + email shape +
 * per-IP rate-limit. On success returns { ok: true } and the
 * client triggers the real magic-link send via NextAuth's signIn().
 *
 * Side effects: none — this endpoint never sends mail directly so
 * a forged POST can't burn through the Resend free tier (NextAuth
 * does its own rate-limiting on the signin endpoint).
 */
import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse, ipFromRequest } from "@/lib/rate-limit";
import { evaluateAntiBot } from "@/lib/anti-bot";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { ANON_COOKIE_NAME, isValidAnonSessionId } from "@/lib/anon-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; billId?: string; hp?: string; renderedAt?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // v15 DEEL 5 anti-bot bundle: honeypot + time-gate + UA blocklist.
  const verdict = evaluateAntiBot({
    honeypot: body.hp ?? null,
    renderedAt: body.renderedAt ?? null,
    userAgent: req.headers.get("user-agent"),
  });
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: `rejected: ${verdict.reason}` },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }
  if (!body.billId || typeof body.billId !== "string") {
    return NextResponse.json({ ok: false, error: "missing bill" }, { status: 400 });
  }

  // Per-IP rate-limit: 5/hour. Defence in depth on top of NextAuth's
  // own signin-rate-limit + Cloudflare's WAF.
  const rl = rateLimit({
    key: `anon-signup:${ipFromRequest(req)}`,
    max: 5,
    windowSec: 3600,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  // v15.1: stamp the email on every anonymous bill in this session so
  // the magic-link callback can claim cross-browser. The cookie alone
  // doesn't survive the email-client → default-browser jump.
  try {
    const jar = await cookies();
    const sid = jar.get(ANON_COOKIE_NAME)?.value;
    if (isValidAnonSessionId(sid)) {
      await prisma.bill.updateMany({
        where: { anonymousSessionId: sid, userId: null },
        data: { anonymousEmail: email },
      });
    }
  } catch {
    // never block the magic-link dispatch on this best-effort stamp
  }

  return NextResponse.json({ ok: true });
}
