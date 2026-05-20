/**
 * /api/inbound — the canonical Resend inbound webhook endpoint.
 *
 * Resend sends ALL inbound email for the domain to one endpoint, so this is
 * the single entry-point. All routing (proof / auto-pingpong / bill-OCR)
 * happens in lib/inbound-handler.ts.
 */
import { handleInbound } from "@/lib/inbound-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleInbound(req);
}
