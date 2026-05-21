/**
 * POST /api/bills/[id]/correct — OCR inline correction (v24 DEEL 2).
 *
 * Lets the owner fix a misread provider / monthly amount / category so a
 * bad OCR read doesn't dead-end. Owner-only; supported categories only
 * (hypotheek/verzekering stay AFM-gated). After writing, the analyse page
 * re-runs the comparison with the corrected values.
 *
 * Body: { provider?: string, monthlyCents?: number, category?: string }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { isSupportedCategory } from "@/lib/market-coverage";
import type { BillCategory } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  "TELECOM", "ENERGIE", "WATER", "GEMEENTE", "VERZEKERING", "HYPOTHEEK",
  "BANK", "ABONNEMENT", "STREAMING", "GYM", "OV", "SOFTWARE", "OPSLAG", "OVERIG",
]);

const Schema = z
  .object({
    provider: z.string().trim().min(1).max(80).optional(),
    monthlyCents: z.number().int().positive().max(100_000).optional(), // ≤ €1000/mo
    category: z.string().trim().optional(),
  })
  .refine((d) => d.provider != null || d.monthlyCents != null || d.category != null, {
    message: "Geef minstens één veld om te corrigeren",
  });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  // Owner-only.
  const bill = await prisma.bill.findFirst({ where: { id, userId }, select: { id: true } });
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige correctie" }, { status: 400 });
  }
  const { provider, monthlyCents, category } = parsed.data;

  const data: Record<string, unknown> = {};
  const corrected: string[] = [];

  if (provider != null) {
    data.provider = provider;
    corrected.push("provider");
  }
  if (monthlyCents != null) {
    // The user corrects the recurring monthly amount → drive the comparison
    // off it (also fixes an amountCents=0 OCR failure).
    data.monthlyCents = monthlyCents;
    data.amountCents = monthlyCents;
    corrected.push("amount");
  }
  if (category != null) {
    if (!VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Onbekende categorie" }, { status: 400 });
    }
    if (!isSupportedCategory(category as BillCategory)) {
      return NextResponse.json({ error: "Deze categorie ondersteunen we niet" }, { status: 400 });
    }
    data.category = category as BillCategory;
    corrected.push("category");
  }

  await prisma.bill.update({ where: { id }, data });
  return NextResponse.json({ ok: true, corrected });
}
