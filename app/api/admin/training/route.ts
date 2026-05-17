import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  sampleId: z.string().min(1),
  anonymizedJson: z.string().min(1).max(20_000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Validate the JSON parses
  try {
    JSON.parse(parsed.data.anonymizedJson);
  } catch {
    return NextResponse.json({ error: "anonymizedJson is not valid JSON" }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;
  await prisma.ocrTrainingSample.update({
    where: { id: parsed.data.sampleId },
    data: {
      anonymizedJson: parsed.data.anonymizedJson,
      reviewed: true,
      reviewerUserId: userId,
    },
  });
  return NextResponse.json({ ok: true });
}
