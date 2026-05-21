/**
 * POST /api/fee-setup — start a hosted Stripe Checkout (mode: setup) so the
 * user can attach a card for the no-cure-no-pay fee (€0 now). Auth required.
 *
 * Body (optional): { returnTo?: string } — where to send the user back to
 * (defaults to the email-generation step). On success Stripe redirects to
 * returnTo?card=ok; the webhook persists the card + mandate.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createFeeSetupSession } from "@/lib/payments";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

function safeReturnTo(raw: unknown): string {
  // Only allow same-site relative paths (no open redirect).
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const email = session.user.email ?? "";

  const rl = rateLimit({ key: `fee-setup:${userId}`, max: 10, windowSec: 3600 });
  if (!rl.ok) return rateLimitResponse(rl);

  let returnTo = "/dashboard";
  let mandateText: string | null = null;
  try {
    const body = (await req.json()) as { returnTo?: unknown; mandateText?: unknown };
    returnTo = safeReturnTo(body.returnTo);
    if (typeof body.mandateText === "string") mandateText = body.mandateText.slice(0, 1000);
  } catch {
    /* no body → defaults */
  }

  // Record the consent text now (audit). The webhook stamps
  // feeMandateAcceptedAt + the payment method once the card is attached.
  if (mandateText) {
    try {
      await prisma.user.update({ where: { id: userId }, data: { feeMandateText: mandateText } });
    } catch {
      /* never block checkout on the audit write */
    }
  }

  const setup = await createFeeSetupSession({ userId, userEmail: email, appUrl: APP_URL, returnTo });
  if (!setup.url) {
    return NextResponse.json({ error: "Could not create setup session" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: setup.url, test: setup.test });
}
