/**
 * POST /api/inbound/router — Resend webhook for inbound mails that
 * relate to an existing negotiation, either as a forwarded proof
 * upload or as a provider reply in the auto-pingpong flow.
 *
 * 401 — missing or invalid HMAC signature
 * 503 — FEATURE_AUTO_PINGPONG disabled AND no proof token present
 * 200 — accepted (even when we couldn't match a thread; webhook must
 *       not retry on parse failures).
 *
 * v12: discriminate-by-subject — [PROOF-<billId>] goes to the proof
 * branch, [NEGOTIATION-<negId>] (or In-Reply-To matching a thread)
 * goes to auto-pingpong, anything else is acked 200.
 */
import { NextResponse } from "next/server";
import {
  INBOUND_ROUTER_SIG_HEADER,
  verifyInboundRouterSignature,
  parseInboundRouterPayload,
} from "@/lib/inbound-router";
import { dispatch, discriminate } from "@/lib/auto-pingpong";
import { isEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get(INBOUND_ROUTER_SIG_HEADER);

  if (!verifyInboundRouterSignature(rawBody, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
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

  // Feature-flag gating depends on the routing intent. Proof branch
  // is independent of FEATURE_AUTO_PINGPONG (it has its own flag in
  // recordProof), so we discriminate first and gate only the
  // negotiation branch.
  const intent = discriminate(payload);
  if (intent.kind === "negotiation" && !isEnabled("AUTO_PINGPONG")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }
  if (intent.kind === "unknown") {
    return NextResponse.json({ ok: true, reason: "no token" }, { status: 200 });
  }

  // Lift attachments out of the parsed envelope onto the payload so the
  // proof branch can run extractBill() without re-parsing.
  const env = (parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const data = (env.data ?? env) as Record<string, unknown>;
  const attRaw = data.attachments;
  const attachmentsBase64: { filename: string; contentType: string; base64: string }[] = [];
  if (Array.isArray(attRaw)) {
    for (const a of attRaw) {
      if (!a || typeof a !== "object") continue;
      const ao = a as Record<string, unknown>;
      const filename = typeof ao.filename === "string" ? ao.filename : "attachment";
      const contentType =
        typeof ao.content_type === "string"
          ? ao.content_type
          : typeof ao.contentType === "string"
          ? ao.contentType
          : "application/octet-stream";
      const base64 =
        typeof ao.content === "string" ? ao.content : typeof ao.base64 === "string" ? ao.base64 : "";
      if (base64.length === 0) continue;
      attachmentsBase64.push({ filename, contentType, base64 });
    }
  }

  const result = await dispatch({ ...payload, attachmentsBase64 });
  return NextResponse.json(result, { status: 200 });
}
