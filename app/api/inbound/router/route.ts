/**
 * POST /api/inbound/router — Resend webhook for provider replies in an
 * existing negotiation thread. Distinct from /api/inbound (which seeds
 * fresh bills) because the auth + matching logic is different.
 *
 * 401 — missing or invalid HMAC signature
 * 503 — FEATURE_AUTO_PINGPONG disabled
 * 200 — accepted (even when we couldn't match a thread; webhook must
 *       not retry on parse failures).
 */
import { NextResponse } from "next/server";
import {
  INBOUND_ROUTER_SIG_HEADER,
  verifyInboundRouterSignature,
  parseInboundRouterPayload,
  routeInboundReply,
} from "@/lib/inbound-router";
import { isEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get(INBOUND_ROUTER_SIG_HEADER);

  if (!verifyInboundRouterSignature(rawBody, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!isEnabled("AUTO_PINGPONG")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "bad json" }, { status: 200 });
  }

  const payload = parseInboundRouterPayload(parsed);
  if (!payload) {
    return NextResponse.json({ ok: false, reason: "unparseable" }, { status: 200 });
  }

  const result = await routeInboundReply(payload);
  return NextResponse.json(result, { status: 200 });
}
