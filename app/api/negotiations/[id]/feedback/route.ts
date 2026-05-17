import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const FeedbackSchema = z.object({
  userRating: z.number().int().min(-1).max(1).optional(),
  mailUsed: z.boolean().optional(),
  providerResponded: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.format() }, { status: 400 });
  }

  // Ensure the negotiation belongs to this user
  const neg = await prisma.negotiation.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!neg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.negotiation.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
