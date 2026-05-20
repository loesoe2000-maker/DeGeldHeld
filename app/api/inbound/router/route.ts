/**
 * /api/inbound/router — legacy auto-pingpong webhook URL.
 *
 * Resend now delivers everything to one endpoint; this path delegates to
 * the canonical handler so an old Resend config keeps working. Routing to
 * the auto-pingpong flow happens by subject-token / In-Reply-To thread /
 * auto@ recipient inside it.
 */
import { handleInbound } from "@/lib/inbound-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleInbound(req);
}
