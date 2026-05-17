import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  analyseProviderResponse,
  actionToState,
  buildCounterContext,
  MAX_ROUNDS,
} from "@/lib/rounds";
import { generateEmail } from "@/lib/negotiator";
import { buildComparison } from "@/lib/comparison";
import { extractBill } from "@/lib/ocr";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { negotiationRoundSchema, firstIssueMessage } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OCR_SIZE = 10 * 1024 * 1024;

async function readBody(req: NextRequest): Promise<{
  negotiationId?: string;
  providerResponse?: string;
  ocrText?: string;
} | { error: string }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const negotiationId = form.get("negotiationId");
    const pastedText = form.get("providerResponse");
    const file = form.get("screenshot");

    let ocrText: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_OCR_SIZE) {
        return { error: "Screenshot groter dan 10 MB" };
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const ocr = await extractBill(buf, file.type || "image/png");
      ocrText = ocr.rawText || "";
    }

    return {
      negotiationId: typeof negotiationId === "string" ? negotiationId : undefined,
      providerResponse: typeof pastedText === "string" ? pastedText : undefined,
      ocrText,
    };
  }

  try {
    const json = (await req.json()) as Record<string, unknown>;
    const parsed = negotiationRoundSchema.safeParse(json);
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
    return parsed.data;
  } catch {
    return { error: "Invalid JSON" };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const rl = rateLimit({ key: `round:${userId}`, max: 10, windowSec: 3600 });
  if (!rl.ok) return rateLimitResponse(rl);

  const body = await readBody(req);
  if ("error" in body) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const { negotiationId, providerResponse, ocrText } = body;
  if (!negotiationId) {
    return NextResponse.json({ error: "negotiationId vereist" }, { status: 400 });
  }
  const responseText = (providerResponse ?? "").trim() || (ocrText ?? "").trim();
  if (!responseText) {
    return NextResponse.json(
      { error: "Provider-antwoord of screenshot vereist" },
      { status: 400 },
    );
  }

  const negotiation = await prisma.negotiation.findFirst({
    where: { id: negotiationId, userId },
    include: { bill: true, rounds: { orderBy: { roundNumber: "asc" } } },
  });
  if (!negotiation) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const roundNumber = negotiation.rounds.length + 1;
  if (roundNumber > MAX_ROUNDS) {
    return NextResponse.json(
      { error: `Maximaal ${MAX_ROUNDS} rondes bereikt` },
      { status: 409 },
    );
  }

  const analysis = await analyseProviderResponse(responseText);
  let counterSubject: string | null = null;
  let counterBody: string | null = null;

  if (analysis.action === "counter") {
    const comparison = buildComparison({
      provider: negotiation.bill.provider,
      category: negotiation.bill.category,
      amountCents: negotiation.bill.amountCents,
    });
    const previousOfferedCents =
      analysis.offeredCents ??
      negotiation.rounds[negotiation.rounds.length - 1]?.offeredCents ??
      null;
    const counterContext = buildCounterContext({
      roundNumber,
      previousOfferedCents,
      previousTone: analysis.tone,
    });

    const compareCents = negotiation.bill.monthlyCents ?? negotiation.bill.amountCents;
    const email = await generateEmail({
      customerName: session.user.name ?? session.user.email ?? "Klant",
      customerEmail: session.user.email ?? undefined,
      provider: negotiation.bill.provider,
      category: negotiation.bill.category,
      currentPlan: negotiation.bill.plan,
      currentMonthlyCents: compareCents,
      customerNumber: negotiation.bill.customerNumber,
      alternatives: comparison.topAlternatives,
    });
    counterSubject = `[Ronde ${roundNumber}] ${email.subject}`;
    counterBody = `${counterContext}\n\n${email.body}`;
  }

  const newState = actionToState(analysis.action);

  const round = await prisma.negotiationRound.create({
    data: {
      negotiationId,
      roundNumber,
      providerResponse: providerResponse ?? null,
      responseOcrText: ocrText ?? null,
      analysisJson: JSON.stringify(analysis),
      offeredCents: analysis.offeredCents ?? null,
      counterSubject,
      counterBody,
      outcome:
        analysis.action === "accept"
          ? "ACCEPTED"
          : analysis.action === "walk_away"
          ? "REJECTED"
          : analysis.action === "escalate"
          ? "ESCALATED"
          : "PENDING",
    },
  });

  await prisma.negotiation.update({
    where: { id: negotiationId },
    data: {
      state: newState,
      ...(newState === "ACCEPTED" || newState === "REJECTED"
        ? { closedAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    roundId: round.id,
    roundNumber,
    state: newState,
    analysis,
    counter: counterSubject ? { subject: counterSubject, body: counterBody } : null,
  });
}
