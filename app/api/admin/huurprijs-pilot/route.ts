/**
 * /api/admin/huurprijs-pilot — v40 F4 — kalibratie-logboek.
 *
 * POST  legt onze VOORSPELLING vast (direct vanaf de check-pagina, zodat de
 *       pilot dezelfde route loopt als een echte gebruiker).
 * PATCH vult later de WERKELIJKHEID aan: eerst de officiële Huurprijscheck,
 *       maanden later de uitspraak.
 *
 * Admin-only: dit is intern kalibratiemateriaal.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Voorspelling = z.object({
  label: z.string().min(2).max(120),
  inputJson: z.string().max(20_000),
  onzePunten: z.number().int().min(0).max(1000),
  onzePuntenRuim: z.number().int().min(0).max(1000),
  onzeMaxHuurCents: z.number().int().min(0).max(1_000_000).nullable(),
  onsVerdict: z.string().min(2).max(40),
  onzeRoute: z.string().min(2).max(60),
  kaleHuurCents: z.number().int().min(0).max(1_000_000),
});

const Werkelijkheid = z.object({
  id: z.string().min(1).max(60),
  officieelPunten: z.number().int().min(0).max(1000).nullable().optional(),
  officieelMaxHuurCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
  uitspraakUitkomst: z
    .enum(["GEWONNEN", "VERLOREN", "GESCHIKT", "INGETROKKEN", "LOPEND"])
    .nullable()
    .optional(),
  uitspraakPunten: z.number().int().min(0).max(1000).nullable().optional(),
  uitspraakVerlagingCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
  intakeNotitie: z.string().max(4000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Voorspelling.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const c = await prisma.huurprijsPilotCase.create({ data: parsed.data });
  return NextResponse.json({ ok: true, id: c.id });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Werkelijkheid.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { id, ...velden } = parsed.data;
  // Alleen meegestuurde velden bijwerken; een lege PATCH wist niets.
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(velden)) if (v !== undefined) data[k] = v;
  if (data.officieelPunten !== undefined) data.officieelGecheckWhen = new Date();
  if (data.uitspraakUitkomst !== undefined && data.uitspraakUitkomst !== "LOPEND") {
    data.uitspraakDatum = new Date();
  }
  const c = await prisma.huurprijsPilotCase.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: c.id });
}
