/**
 * POST /api/claims/suggest-bedrag — v37.
 *
 * Leest een geüploade uitspraak/afrekening (PDF of foto) en geeft een
 * BEDRAG-SUGGESTIE terug — NOOIT bindend, NOOIT opslaand, NOOIT chargend.
 * De klant ziet de suggestie + context en bevestigt zelf in het bedrag-veld.
 *
 * Doel: minder handmatig overtypen, zonder de risico's van auto-charge op
 * een OCR-getal. Dit endpoint muteert NIETS in de database.
 *
 * Auth-gated (alleen ingelogde klanten in de claim-flow). Geen flag van
 * zichzelf — leunt op de check-flags die de claim-pagina's al gaten.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractBill, validateUploadedFile, pdfFallbackMessage } from "@/lib/ocr";
import { extractPdfText } from "@/lib/pdf_extract";
import { suggestUitspraakBedrag } from "@/lib/uitspraak-bedrag";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form-data required" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const v = validateUploadedFile({ size: file.size, type: file.type });
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Haal tekst uit het document. PDF → directe tekst-extractie (geen LLM-kosten
  // als 't een tekst-PDF is). Foto/scan → Groq Vision via extractBill (de
  // rawText daarvan bevat de uitgelezen tekst).
  let text = "";
  let hint: string | null = null;
  try {
    if (file.type.toLowerCase() === "application/pdf") {
      const pdf = await extractPdfText(buf);
      text = pdf.text ?? "";
      if (!pdf.ok || pdf.empty) {
        hint = pdfFallbackMessage(text) ?? "We konden de PDF niet uitlezen — vul het bedrag handmatig in.";
      }
    } else {
      const ocr = await extractBill(buf, file.type);
      text = ocr.rawText ?? "";
      hint = pdfFallbackMessage(text);
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "claims-suggest-bedrag" } });
    return NextResponse.json(
      { ok: false, hint: "Automatisch uitlezen mislukte — vul het bedrag handmatig in." },
      { status: 200 }, // 200: dit is geen blokkerende fout, klant typt gewoon
    );
  }

  const suggestie = suggestUitspraakBedrag(text);
  if (!suggestie) {
    return NextResponse.json({
      ok: true,
      found: false,
      hint:
        hint ??
        "We vonden geen duidelijk bedrag in het document. Vul het werkelijk teruggekregen bedrag zelf in.",
    });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    cents: suggestie.cents,
    confidence: suggestie.confidence,
    context: suggestie.context,
    hint:
      suggestie.confidence === "low"
        ? "We vonden een bedrag maar zijn er niet zeker van — controleer het goed."
        : null,
  });
}
