/**
 * /api/inbound — the canonical Resend inbound webhook endpoint.
 *
 * Resend sends ALL inbound email for the domain to one endpoint, so this is
 * the single entry-point. All routing (proof / auto-pingpong / bill-OCR)
 * happens in lib/inbound-handler.ts.
 */
import { handleInbound } from "@/lib/inbound-handler";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleInbound(req);
}

// Temporary diagnostic (gated by CRON_SECRET): reports what the deployed
// server actually holds for RESEND_WEBHOOK_SECRET — set?, length, and an
// 8-char SHA-256 prefix — so we can confirm whether it matches the value
// configured in the Resend dashboard, without ever echoing the secret.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const s = process.env.RESEND_WEBHOOK_SECRET ?? "";
  return NextResponse.json({
    secretSet: !!s,
    secretLen: s.length,
    secretSha8: s ? crypto.createHash("sha256").update(s).digest("hex").slice(0, 8) : null,
  });
}
