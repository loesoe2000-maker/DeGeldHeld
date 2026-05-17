import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { waitlistSchema } from "@/lib/validation";
import { sendEmail, welcomeEmailHtml } from "@/lib/email";
import { rateLimit, rateLimitResponse, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = rateLimit({ key: `waitlist:${ipFromRequest(req)}`, max: 3, windowSec: 3600 });
  if (!rl.ok) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 },
    );
  }

  const { email, source } = parsed.data;

  try {
    const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: true, status: "already_subscribed" });
    }

    await prisma.waitlistEntry.create({ data: { email, source } });
    await sendEmail({
      to: email,
      subject: "Welkom bij DeGeldHeld 🌱",
      html: welcomeEmailHtml(email),
    }).catch(() => {
      // best-effort — don't fail signup if email bounces
    });

    return NextResponse.json({ ok: true, status: "subscribed" });
  } catch (err) {
    console.error("waitlist error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
