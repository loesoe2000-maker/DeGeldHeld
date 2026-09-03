/**
 * POST /api/admin/seed-success
 *
 * Admin-only tool om historische, offline-uitgevoerde onderhandelingen
 * toe te voegen aan /proof. Gebruik dit alléén voor onderhandelingen
 * die je écht hebt gedaan (vrienden/familie pre-DeGeldHeld) — niet om
 * cijfers te vervalsen.
 *
 * Ook MISLUKTE echte pogingen horen erin (outcome: "FAILED"): die tellen
 * mee in het slagingspercentage maar niet in het bespaarde totaal. Een
 * track record zonder mislukkingen is ongeloofwaardig — eerlijkheid is
 * hier het product.
 *
 * Gemarkeerd als adminSeeded via reasoning-prefix zodat we ze later
 * kunnen filteren van organic data.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { findProvider } from "@/lib/providers";

const ALLOWED_CATEGORIES = [
  "TELECOM",
  "ENERGIE",
  "VERZEKERING",
  "HYPOTHEEK",
  "BANK",
  "ABONNEMENT",
  "OVERIG",
] as const;

const ALLOWED_COUNTRIES = ["NL", "BE", "DE", "FR", "UK", "US", "ES", "IT"] as const;

const Body = z.object({
  provider: z.string().min(2).max(80),
  category: z.enum(ALLOWED_CATEGORIES),
  country: z.enum(ALLOWED_COUNTRIES).default("NL"),
  beforeMonthlyCents: z.number().int().min(100).max(1_000_000),
  afterMonthlyCents: z.number().int().min(0).max(1_000_000),
  customerYears: z.number().int().min(0).max(50).default(3),
  note: z.string().max(200).optional(),
  daysAgo: z.number().int().min(0).max(365).default(0),
  outcome: z.enum(["SUCCESS", "FAILED"]).default("SUCCESS"),
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const {
    provider,
    category,
    country,
    beforeMonthlyCents,
    afterMonthlyCents,
    customerYears,
    note,
    daysAgo,
    outcome,
  } = parsed.data;

  if (afterMonthlyCents >= beforeMonthlyCents) {
    return NextResponse.json(
      { error: "After-amount moet lager zijn dan before-amount" },
      { status: 400 },
    );
  }

  // "kpn"/"ENECO" → "KPN"/"Eneco": anders splitsen /proof-lijstjes per schrijfwijze.
  const providerName = findProvider(provider)?.canonical ?? provider.trim();
  const monthlySaving = beforeMonthlyCents - afterMonthlyCents;
  const yearlySaving = monthlySaving * 12;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  // Maak een anonieme user voor deze historische case. Email per case
  // uniek zodat we niet bij dezelfde user accumuleren.
  const anonId = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Eén transactie: nooit een halve seed (user zonder bill/negotiation).
  const { bill, negotiation } = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: {
      email: `${anonId}@seed.degeldheld.com`,
      name: "Geanonimiseerd",
      emailVerified: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
  });

  const bill = await tx.bill.create({
    data: {
      userId: user.id,
      provider: providerName,
      category,
      country,
      amountCents: beforeMonthlyCents,
      monthlyCents: beforeMonthlyCents,
      totalCents: beforeMonthlyCents,
      rawOcr: "ADMIN_SEEDED",
      createdAt,
    },
  });

  const negotiation = await tx.negotiation.create({
    data: {
      userId: user.id,
      billId: bill.id,
      state: outcome,
      strategy: "RETENTIE_DREIG",
      // expected = waar de poging op mikte; actual alléén bij succes —
      // zo telt FAILED mee in het slagingspercentage, niet in het totaal.
      expectedSavingsCents: yearlySaving,
      actualSavingsCents: outcome === "SUCCESS" ? yearlySaving : null,
      confidence: 0.9,
      reasoning: `ADMIN_SEEDED — ${customerYears}j klant. ${
        note ??
        (outcome === "SUCCESS"
          ? "Historische case, offline uitgevoerd."
          : "Historische poging, offline uitgevoerd — niet gelukt.")
      }`,
      createdAt,
      updatedAt: createdAt,
    },
  });

  return { bill, negotiation };
  });

  return NextResponse.json({
    ok: true,
    billId: bill.id,
    negotiationId: negotiation.id,
    outcome,
    yearlySavingCents: yearlySaving,
  });
}
