/**
 * POST /api/volmacht/[claimType]/[claimId]/sign — v36 idee 2.
 *
 * Auth-gated + flag-gated. Verifieert dat:
 *   - claimType is HuurServicekostenClaim of EnergieEindafrekeningClaim
 *   - de claim bestaat én is van de ingelogde user
 *   - er nog geen actieve volmacht ligt voor deze (claimType, claimId)
 *   - de geposte fullName valide is (≥ 5 chars, voor + achternaam)
 *   - de geposte acceptedText matcht met de actuele template-versie
 *
 * Persisteert de Volmacht-row met IP-hash + user-agent + exact accepted-text.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { ipFromRequest } from "@/lib/rate-limit";
import {
  validateSignInput,
  VOLMACHT_TEMPLATE_VERSION,
  type VolmachtClaimType,
} from "@/lib/volmacht";
import { hashIp } from "@/lib/volmacht-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { claimType: string; claimId: string } };

async function claimBelongsToUser(
  claimType: VolmachtClaimType,
  claimId: string,
  userId: string,
): Promise<boolean> {
  if (claimType === "HuurServicekostenClaim") {
    const c = await prisma.huurServicekostenClaim.findUnique({
      where: { id: claimId },
      select: { userId: true },
    });
    return c?.userId === userId;
  }
  // EnergieEindafrekeningClaim
  const c = await prisma.energieEindafrekeningClaim.findUnique({
    where: { id: claimId },
    select: { userId: true },
  });
  return c?.userId === userId;
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!isEnabled("VOLMACHT_SES_ENABLED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  let body: { fullName?: unknown; acceptedText?: unknown };
  try {
    body = (await req.json()) as { fullName?: unknown; acceptedText?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateSignInput({
    claimType: params.claimType,
    claimId: params.claimId,
    fullName: typeof body.fullName === "string" ? body.fullName : "",
    acceptedText: typeof body.acceptedText === "string" ? body.acceptedText : "",
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const owns = await claimBelongsToUser(
    validation.claimType,
    validation.claimId,
    userId,
  );
  if (!owns) {
    // 404 i.p.v. 403 om bestaan van andermans claim-IDs niet te bevestigen.
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  const existing = await prisma.volmacht.findUnique({
    where: {
      claimType_claimId: {
        claimType: validation.claimType,
        claimId: validation.claimId,
      },
    },
    select: { id: true, revokedAt: true },
  });
  if (existing && !existing.revokedAt) {
    return NextResponse.json(
      { error: "Er is al een actieve volmacht voor deze claim." },
      { status: 409 },
    );
  }

  const ip = ipFromRequest(req);
  const ipH = hashIp(ip);
  const userAgent = req.headers.get("user-agent") ?? null;

  const volmacht = await prisma.volmacht.create({
    data: {
      userId,
      claimType: validation.claimType,
      claimId: validation.claimId,
      fullName: validation.fullName,
      templateVersion: VOLMACHT_TEMPLATE_VERSION,
      mandateText: validation.mandateText,
      ipHash: ipH,
      userAgent,
    },
    select: { id: true, signedAt: true, templateVersion: true },
  });

  return NextResponse.json({ ok: true, volmacht }, { status: 201 });
}
