/**
 * /api/inbound/proof — legacy proof webhook URL.
 *
 * Resend now delivers everything to one endpoint; this path delegates to
 * the canonical handler so an old Resend config keeps working. Routing to
 * the proof flow happens by subject-token / bewijs@ recipient inside it.
 */
import { handleInbound } from "@/lib/inbound-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleInbound(req);
}
