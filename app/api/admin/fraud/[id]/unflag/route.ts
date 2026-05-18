/**
 * POST /api/admin/fraud/[id]/unflag — mark a FraudFlag as resolved
 * without suspending the user. Admin-only.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const session = await auth();
  const adminEmail = session?.user?.email ?? "unknown";
  const { id } = await ctx.params;
  const flag = await prisma.fraudFlag.findUnique({ where: { id } });
  if (!flag) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.fraudFlag.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date(), resolvedBy: adminEmail },
  });
  return NextResponse.redirect(new URL("/admin/fraud", _req.url), 303);
}
