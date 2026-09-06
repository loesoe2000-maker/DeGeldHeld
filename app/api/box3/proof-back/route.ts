/**
 * POST /api/box3/proof-back — v30 DEEL 1.
 *
 * Upload van een Belastingdienst-beschikking (PDF). OCR (pdfjs) → regex-parse
 * van het toegekende bedrag → deterministisch CHARGED / FAILED via
 * v41: er wordt niets meer geïncasseerd — de beschikking wordt nog wél
 * gelezen en vastgelegd, alleen de fee is altijd € 0.
 *
 * AVG-grondslag voor opslag van Box3Claim + storageUrl: noodzakelijk voor de
 * uitvoering van de NCNP-overeenkomst (zie V30_REPORT.md).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import { extractPdfText } from "@/lib/pdf_extract";
import { sendEmail } from "@/lib/email";
import * as Sentry from "@sentry/nextjs";
import { notifyOwner } from "@/lib/owner-alerts";
import {
  processProofUpload,
  type Box3ClaimStatus,
} from "@/lib/box3-claim";
import { uploadClaimProof } from "@/lib/claim-proof-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

export async function POST(req: Request) {
  if (!isEnabled("BOX3_CHECK_ENABLED")) {
    return NextResponse.json({ error: "Not found", reason: "disabled" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // We accepteren elke vorm waaruit we een FormData kunnen lezen — jsdom's
  // Request zet bij FormData-body GEEN multipart-content-type, dus een
  // strikte header-check zou de test-omgeving onnodig blokkeren.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form-data required" }, { status: 400 });
  }

  const claimId = String(form.get("claimId") ?? "");
  const file = form.get("file");
  if (!claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  // Anti-abuse: claim moet van de caller zijn + in een terminale-vrije status staan.
  const claim = await prisma.box3Claim.findFirst({
    where: { id: claimId, userId },
  });
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (claim.status === "CHARGED" || claim.status === "FAILED") {
    return NextResponse.json(
      { error: "claim already settled", status: claim.status },
      { status: 409 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // v37 — bewaar de beschikking-PDF in Vercel Blob (private) VÓÓR de OCR +
  // automatische fee-charge. Lukt opslaan niet, dan stoppen we hier (502):
  // bij Box 3 schrijft de fee zichzelf af op basis van de OCR, dus we mogen
  // NOOIT char-gen zonder de beschikking als bewijs bewaard te hebben.
  const proofStorageUrl = await uploadClaimProof({
    claimType: "Box3Claim",
    userId,
    claimId: claim.id,
    file: buf,
    filename: file.name || `box3-beschikking-${claim.id}.pdf`,
    contentType: file.type || "application/pdf",
  });
  if (!proofStorageUrl) {
    return NextResponse.json(
      { error: "Het bewijs kon niet worden opgeslagen. Probeer het opnieuw." },
      { status: 502 },
    );
  }

  let pdfText = "";
  try {
    const pdf = await extractPdfText(buf);
    pdfText = pdf.text ?? "";
    if (!pdf.ok || pdf.empty) {
      // v36 owner-alert: PDF onleesbaar / leeg → owner krijgt direct mail.
      void notifyOwner("ocr-failed", {
        summary: `Box 3 proof-back PDF empty/unreadable (claim ${claim.id.slice(0, 8)})`,
        ref: claim.id,
        details: {
          claimId: claim.id,
          jaar: claim.jaar,
          pdfPages: pdf.pages,
          extractedPages: pdf.extractedPages,
          passwordProtected: pdf.passwordProtected ?? false,
        },
      });
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "box3-proof-back", stage: "pdf" } });
    void notifyOwner("ocr-failed", {
      summary: `Box 3 proof-back PDF extraction threw (claim ${claim.id.slice(0, 8)})`,
      ref: claim.id,
      details: { claimId: claim.id, error: (e as Error).message },
    });
  }

  // Pure beslis-pipeline (testbaar zonder formData) + Stripe-charge bij ok.
  const outcome = await processProofUpload({
    userId,
    claimId: claim.id,
    pdfText,
    // v41 — GRATIS PLATFORM. Stripe krijgt deze route niet meer in handen.
    // De pipeline stopt al bij fee € 0; dit is de tweede sluiting, zodat er
    // ook geen incasso-functie meer ligt om per ongeluk te activeren.
    charge: async () => ({ ok: false as const, reason: "fee-disabled" }),
  });

  // v37 — charge-fail is NIET terminaal. De beschikking is gelezen; alleen het
  // afschrijven faalde (meestal: geen kaart/mandaat op het account). Status
  // blijft PROOF_RECEIVED zodat (a) de klant na het toevoegen van een kaart
  // opnieuw kan uploaden (PROOF_RECEIVED zit niet in het 409-blok), en (b) de
  // owner 'm handmatig kan afronden via /admin/claims (PROOF_RECEIVED is daar
  // chargeable). Vóór deze fix werd dit FAILED → permanent gebrickte claim.
  if (outcome.kind === "charge-failed") {
    await prisma.box3Claim.update({
      where: { id: claim.id },
      data: {
        status: "PROOF_RECEIVED" satisfies Box3ClaimStatus,
        proofUploadedAt: new Date(),
        werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents,
        failureReason: outcome.reason,
        ...(proofStorageUrl ? { proofStorageUrl } : {}),
      },
    });
    try {
      const adminEmail = process.env.ADMIN_REVIEW_EMAIL ?? "hallo@degeldheld.com";
      await sendEmail({
        to: adminEmail,
        subject: `Box 3 charge gefaald — claim ${claim.id} (beschikking wél gelezen)`,
        text:
          `Fee-charge faalde, claim staat op PROOF_RECEIVED (herstelbaar).\n` +
          `Claim: ${claim.id}\nUser: ${userId}\nJaar: ${claim.jaar}\n` +
          `Werkelijk: ${outcome.werkelijkTeruggaveCents} cents\n` +
          `Reden: ${outcome.reason}\n` +
          `Herstel: klant voegt kaart toe + uploadt opnieuw, óf charge handmatig via /admin/claims.`,
        html: `<p>Fee-charge faalde — claim blijft <strong>PROOF_RECEIVED</strong> (herstelbaar).</p>
<ul>
  <li>Claim: <code>${claim.id}</code></li>
  <li>User: <code>${userId}</code></li>
  <li>Jaar: ${claim.jaar}</li>
  <li>Werkelijk: ${outcome.werkelijkTeruggaveCents} cents</li>
  <li>Reden: ${outcome.reason}</li>
</ul>
<p>Herstel: klant voegt kaart toe + uploadt opnieuw, óf charge handmatig via /admin/claims.</p>`,
      });
    } catch {
      /* never block on outbound mail */
    }
    void notifyOwner("claim-failed", {
      summary: `Box 3 charge gefaald (herstelbaar): ${outcome.reason}`,
      ref: claim.id,
      details: {
        claimType: "Box3Claim",
        claimId: claim.id,
        jaar: claim.jaar,
        werkelijkeCents: outcome.werkelijkTeruggaveCents,
        herstelbaar: true,
      },
    });
    return NextResponse.json({
      ok: false,
      status: "PROOF_RECEIVED",
      reason: "charge-failed",
      detail: outcome.reason,
      werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents,
    });
  }

  if (outcome.kind === "failed") {
    await prisma.box3Claim.update({
      where: { id: claim.id },
      data: {
        status: "FAILED" satisfies Box3ClaimStatus,
        proofUploadedAt: new Date(),
        werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents ?? null,
        failureReason: outcome.reason,
        ...(proofStorageUrl ? { proofStorageUrl } : {}),
      },
    });
    // Owner krijgt een mail voor handmatige review — géén stille uitkering.
    try {
      const adminEmail = process.env.ADMIN_REVIEW_EMAIL ?? "hallo@degeldheld.com";
      await sendEmail({
        to: adminEmail,
        subject: `Box 3 proof-back FAILED — claim ${claim.id}`,
        text: `Handmatige review nodig.\nClaim: ${claim.id}\nUser: ${userId}\nJaar: ${claim.jaar}\nReden: ${outcome.reason}`,
        html: `<p>Handmatige review nodig.</p>
<ul>
  <li>Claim: <code>${claim.id}</code></li>
  <li>User: <code>${userId}</code></li>
  <li>Jaar: ${claim.jaar}</li>
  <li>Reden: ${outcome.reason}</li>
</ul>`,
      });
    } catch {
      /* never block on outbound mail */
    }
    // v36 — owner-alert kanaal (dedup'd, throttled). Naast de ADMIN_REVIEW_EMAIL-
    // mail krijgen we hier een uniform-geformatteerde alert via OWNER_EMAIL.
    void notifyOwner("claim-failed", {
      summary: `Box 3 claim FAILED: ${outcome.reason}`,
      ref: claim.id,
      details: {
        claimType: "Box3Claim",
        claimId: claim.id,
        jaar: claim.jaar,
        werkelijkeCents: outcome.werkelijkTeruggaveCents ?? null,
      },
    });
    return NextResponse.json({
      ok: false,
      status: "FAILED",
      reason: outcome.reason,
      werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents ?? null,
    });
  }

  if (outcome.kind === "no-fee") {
    await prisma.box3Claim.update({
      where: { id: claim.id },
      data: {
        status: "CHARGED" satisfies Box3ClaimStatus,
        proofUploadedAt: new Date(),
        werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents,
        chargedAt: new Date(),
        feeCents: 0,
        ...(proofStorageUrl ? { proofStorageUrl } : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      status: "CHARGED",
      werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents,
      feeCents: 0,
      reden: "Werkelijk teruggehaalde bedrag onder € 500 — geen fee.",
    });
  }

  // outcome.kind === "charged" — fee deterministisch afgeschreven.
  await prisma.box3Claim.update({
    where: { id: claim.id },
    data: {
      status: "CHARGED" satisfies Box3ClaimStatus,
      proofUploadedAt: new Date(),
      werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents,
      chargedAt: new Date(),
      feeCents: outcome.feeCents,
      stripePaymentIntentId: outcome.paymentIntentId,
      ...(proofStorageUrl ? { proofStorageUrl } : {}),
    },
  });
  return NextResponse.json({
    ok: true,
    status: "CHARGED",
    werkelijkTeruggaveCents: outcome.werkelijkTeruggaveCents,
    feeCents: outcome.feeCents,
    paymentIntentId: outcome.paymentIntentId,
  });
}
