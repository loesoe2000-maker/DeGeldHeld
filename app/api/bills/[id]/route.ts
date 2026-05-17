import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/bills/[id]
 *
 * Soft-deletes the bill (sets Bill.deletedAt). The aggregate /proof
 * endpoint keeps counting these for the public track record, but they
 * become invisible to the owning user.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const bill = await prisma.bill.findFirst({ where: { id, userId }, select: { id: true } });
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.bill.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
