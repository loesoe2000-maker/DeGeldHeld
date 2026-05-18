/**
 * POST /api/outcome/[id]/proof — direct upload of a savings-proof.
 *
 *  [id] = Negotiation.id
 *  Body = multipart/form-data with field "file" (image/pdf) OR
 *         application/json { amountCents, kind?: "manual" }
 *
 *  200 — proof recorded; verdict in response body
 *  401 — unauthenticated
 *  403 — not the owner of the negotiation
 *  404 — negotiation not found
 *  413 — file too large
 *  503 — feature flag off
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { extractBill } from "@/lib/ocr";
import { recordProof, type ProofKind } from "@/lib/outcome-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isEnabled("PROOF_REQUIRED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const negotiation = await prisma.negotiation.findUnique({
    where: { id },
    include: { bill: true },
  });
  if (!negotiation) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (negotiation.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ct = req.headers.get("content-type") ?? "";
  let newAmountCents: number | null = null;
  let kind: ProofKind = "screenshot";

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "file too large" }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const ocr = await extractBill(buf, file.type || "image/png");
      newAmountCents = ocr.monthlyAmountCents ?? ocr.amountCents ?? null;
      kind = "new_bill";
    } catch {
      newAmountCents = null;
    }
  } else if (ct.includes("application/json")) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (typeof body.amountCents === "number" && Number.isFinite(body.amountCents)) {
        newAmountCents = Math.round(body.amountCents);
      }
      if (typeof body.kind === "string") {
        kind = body.kind as ProofKind;
      } else {
        kind = "manual";
      }
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: "content-type must be multipart/form-data or application/json" },
      { status: 400 },
    );
  }

  const oldMonthly = negotiation.bill.monthlyCents ?? negotiation.bill.amountCents;
  const { proofId, verdict } = await recordProof({
    negotiationId: negotiation.id,
    kind,
    storageUrl: null,
    newAmountCents,
    oldMonthlyCents: oldMonthly,
  });
  return NextResponse.json({ ok: true, proofId, verdict }, { status: 200 });
}
