/**
 * POST /api/negotiations/[id]/relay-authorize
 *
 * GUARDRAIL 1 (consent-first): the customer authorizes DeGeldHeld to
 * negotiate on their behalf. Records the exact accepted text + a timestamp +
 * a crypto-random relay token, and flips relayState → RELAY_ACTIVE. Nothing
 * is ever relayed without this. Only the bill owner can authorize (anti-abuse).
 *
 * Body (optional): { providerEmail?: string }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateRelayToken, relayMandateText, relayAddressSanity } from "@/lib/relay";
import { sendFirstRelayMail } from "@/lib/relay-send";
import { isEnabled } from "@/lib/feature-flags";
import { categoryAllowsFee } from "@/lib/category-strategy";
import type { Category } from "@/lib/providers";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // GUARDRAIL 7 — relay is OWNER/lawyer-gated. Off → relay does not exist.
  if (!isEnabled("RELAY_ENABLED")) {
    return NextResponse.json({ error: "Not found", reason: "disabled" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  // Anti-abuse: only the owner of this negotiation can authorize a relay.
  const negotiation = await prisma.negotiation.findFirst({
    where: { id, userId },
    include: { bill: { select: { provider: true, category: true } } },
  });
  if (!negotiation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // GUARDRAIL 8 (v37) — CATEGORIE-GATE. Relay-mail = no-cure-no-pay-werk, dus
  // alleen voor categorieën waar een fee mag (TYPE_A_NCNP). TYPE_B (telecom,
  // streaming, OV, …) en TYPE_C (water-monopolie) worden HARD geweigerd: voor
  // telecom loopt retentie via de telefoon, niet via mail. Voorheen was dit
  // alleen een UI-waarschuwing — een handmatig ingetypt adres kon 'm omzeilen.
  if (!categoryAllowsFee(negotiation.bill.category as Category)) {
    return NextResponse.json(
      { error: "category not eligible for relay", reason: "category-no-fee" },
      { status: 403 },
    );
  }

  // GUARDRAIL 4 — VERVALLEN PER v41. Hier stond: geen gekoppelde betaalkaart
  // + geaccepteerd mandaat → geen relay. Die eis bestond omdat een bewezen
  // besparing incasseerbaar moest zijn. Er wordt niets meer geïncasseerd, dus
  // een kaart eisen zou een drempel zijn zonder doel. De inhoudelijke
  // guardrails (1-3) en de adres-bevestiging hieronder blijven onverkort.

  let providerEmail: string | null = null;
  try {
    const body = (await req.json()) as { providerEmail?: unknown };
    providerEmail = cleanEmail(body.providerEmail);
  } catch {
    /* no body → handled by the address-required gate below */
  }

  // v26 CONFIRM-BEFORE-SEND — no relay starts without a confirmed/entered
  // provider address. The consent UI either confirms a verified registry
  // address or requires the customer to type one; this is the server backstop.
  if (!providerEmail) {
    return NextResponse.json({ error: "address required", reason: "address-required" }, { status: 409 });
  }

  // v26 ADDRESS SANITY — never mail a no-reply mailbox or a malformed address.
  const sanity = relayAddressSanity(providerEmail);
  if (!sanity.ok) {
    return NextResponse.json({ error: "bad address", reason: sanity.reason }, { status: 409 });
  }

  // Idempotent: keep an existing token (so the reply-to stays stable).
  const token = negotiation.relayToken ?? generateRelayToken();
  const authText = relayMandateText(negotiation.bill.provider);

  await prisma.negotiation.update({
    where: { id: negotiation.id },
    data: {
      relayAuthorizedAt: new Date(),
      relayAuthText: authText,
      relayToken: token,
      relayState: "RELAY_ACTIVE",
      providerEmail,
    },
  });

  // Send the first mail on behalf right away (consent-gated inside
  // sendFirstRelayMail). We always have a vetted address here.
  let firstSend: string;
  try {
    const r = await sendFirstRelayMail(negotiation.id);
    firstSend = r.ok ? "sent" : r.reason;
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "relay-authorize" } });
    firstSend = "error";
  }

  return NextResponse.json({ ok: true, relayState: "RELAY_ACTIVE", firstSend });
}
