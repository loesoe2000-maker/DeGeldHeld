import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  confirm: z.literal("VERWIJDER MIJN ACCOUNT"),
});

/**
 * POST /api/account/delete — GDPR Article 17.
 *
 * Two-step confirmation: client must POST {confirm: "VERWIJDER MIJN ACCOUNT"}.
 * Soft-deletes the user (sets deletedAt + scrubs PII) and invalidates
 * all sessions. Bills/negotiations are kept (foreign-key parents) but
 * orphaned via deletedAt so /proof aggregates remain stable.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vul exact 'VERWIJDER MIJN ACCOUNT' in om te bevestigen." },
      { status: 400 },
    );
  }

  const stamp = Date.now();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${stamp}-${userId.slice(0, 6)}@example.invalid`,
        name: null,
        deletedAt: new Date(),
        notificationsEnabled: false,
      },
    }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.bill.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
