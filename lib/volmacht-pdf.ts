/**
 * lib/volmacht-pdf.ts — v36 idee 2 — PDF-generator voor papier-volmacht.
 *
 * Genereert een voorgevuld machtigingsformulier conform de eisen die
 * de Huurcommissie en Geschillencommissie Energie stellen aan een
 * volmacht door een consument:
 *  - gegevens volmachtgever (klant) + gemachtigde (Techz B.V. KvK)
 *  - zaak-identifier (boekjaar of factuurnummer)
 *  - datum-ondertekening
 *  - einddatum (uiterlijk 12 maanden later)
 *  - scope-beperking (geen nieuw contract, geen wijziging, geen incasso)
 *  - plek voor handtekening + datum-veld
 *
 * pdf-lib is pure JS, werkt in Vercel-serverless zonder native deps.
 *
 * SERVER-ONLY — bevat geen client-imports.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { VolmachtClaimType } from "@/lib/volmacht";
import { addMonths } from "@/lib/date-utils";

export type GenerateVolmachtPdfInput = {
  claimType: VolmachtClaimType;
  klant: {
    fullName: string;
    email: string;
    address?: string | null; // optioneel — klant vult later in als ontbrekend
  };
  zaakIdentifier: string;
  /** Datum van uitgifte (template-datum, niet de feitelijke handtekening-datum). */
  uitgifteDatum: Date;
};

const TECHZ_NAAM = "Techz B.V., handelend onder DeGeldHeld";
const TECHZ_KVK = "84079398";
const TECHZ_EMAIL = "hallo@degeldheld.com";

const TITLES: Record<VolmachtClaimType, string> = {
  HuurServicekostenClaim:
    "Machtiging — bezwaar servicekosten-jaarafrekening (Huurcommissie)",
  EnergieEindafrekeningClaim:
    "Machtiging — klacht energie-eindafrekening (Geschillencommissie Energie)",
};

function bodyText(
  claimType: VolmachtClaimType,
  klantNaam: string,
  zaakId: string,
  uitgifte: Date,
  einde: Date,
): string {
  const datum = uitgifte.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const eindDatum = einde.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (claimType === "HuurServicekostenClaim") {
    return (
      `Ondergetekende, ${klantNaam}, machtigt hierbij ` +
      `${TECHZ_NAAM} (KvK ${TECHZ_KVK}) om namens ondergetekende ` +
      `te corresponderen, stukken in te dienen en juridische stappen te ` +
      `zetten in het bezwaar tegen de servicekosten-jaarafrekening voor ` +
      `boekjaar ${zaakId} bij de verhuurder en, indien nodig, bij de ` +
      `Huurcommissie.\n\n` +
      `Deze volmacht is uitsluitend bestemd voor deze specifieke jaar-` +
      `afrekening (zaak-identifier: ${zaakId}). De gemachtigde mag ` +
      `NIET namens ondergetekende:\n` +
      `  • een nieuw huurcontract afsluiten;\n` +
      `  • het huidige huurcontract wijzigen of beëindigen;\n` +
      `  • een schikking accepteren die ondergetekende benadeelt;\n` +
      `  • betalings- of incassoafspraken wijzigen.\n\n` +
      `Datum van uitgifte: ${datum}.\n` +
      `Deze volmacht eindigt van rechtswege op ${eindDatum} (12 maanden ` +
      `na uitgifte) of bij onherroepelijke afsluiting van de procedure, ` +
      `welk moment ook het eerst plaatsvindt.\n\n` +
      `Ondergetekende kan deze volmacht op elk moment intrekken via een ` +
      `bericht aan ${TECHZ_EMAIL}.\n\n` +
      `Deze volmacht is opgemaakt conform art. 3:61 BW jo. art. 25 ` +
      `Verordening (EU) 910/2014 (eIDAS).`
    );
  }
  // EnergieEindafrekeningClaim
  return (
    `Ondergetekende, ${klantNaam}, machtigt hierbij ` +
    `${TECHZ_NAAM} (KvK ${TECHZ_KVK}) om namens ondergetekende ` +
    `te corresponderen, stukken in te dienen en juridische stappen te ` +
    `zetten in de klacht over de energie-eindafrekening met identifier ` +
    `${zaakId} bij de energieleverancier en, indien nodig, bij de ` +
    `Geschillencommissie Energie.\n\n` +
    `Deze volmacht is uitsluitend bestemd voor deze specifieke ` +
    `eindafrekening (zaak-identifier: ${zaakId}). De gemachtigde mag ` +
    `NIET namens ondergetekende:\n` +
    `  • een nieuw energiecontract afsluiten;\n` +
    `  • van energieleverancier wisselen;\n` +
    `  • een contractwijziging accepteren;\n` +
    `  • betalings- of incassoafspraken wijzigen.\n\n` +
    `Datum van uitgifte: ${datum}.\n` +
    `Deze volmacht eindigt van rechtswege op ${eindDatum} (12 maanden ` +
    `na uitgifte) of bij onherroepelijke afsluiting van de klacht/` +
    `procedure, welk moment ook het eerst plaatsvindt.\n\n` +
    `Ondergetekende kan deze volmacht op elk moment intrekken via een ` +
    `bericht aan ${TECHZ_EMAIL}.\n\n` +
    `Deze volmacht is opgemaakt conform art. 3:61 BW jo. art. 25 ` +
    `Verordening (EU) 910/2014 (eIDAS).`
  );
}

/**
 * Genereer de PDF als Uint8Array. Caller streamt of bufferd verder.
 * Single A4-pagina; ondertekenings-blok onderaan.
 */
export async function generateVolmachtPdf(
  input: GenerateVolmachtPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(TITLES[input.claimType]);
  doc.setAuthor("DeGeldHeld");
  doc.setSubject("Machtiging consument");
  doc.setCreator("DeGeldHeld");
  doc.setCreationDate(input.uitgifteDatum);

  const page = doc.addPage([595.28, 841.89]); // A4 portrait points
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const grey = rgb(0.35, 0.35, 0.4);

  const marginX = 50;
  const startY = 800;
  let y = startY;

  // Header
  page.drawText("DeGeldHeld", {
    x: marginX,
    y,
    size: 11,
    font: helvBold,
    color: grey,
  });
  page.drawText(`Techz B.V. · KvK ${TECHZ_KVK} · ${TECHZ_EMAIL}`, {
    x: marginX,
    y: y - 14,
    size: 9,
    font: helv,
    color: grey,
  });
  y -= 50;

  // Titel
  page.drawText(TITLES[input.claimType], {
    x: marginX,
    y,
    size: 14,
    font: helvBold,
    color: black,
    maxWidth: 500,
  });
  y -= 30;

  // Klant-blok
  page.drawText("Volmachtgever (ondergetekende):", {
    x: marginX,
    y,
    size: 10,
    font: helvBold,
    color: black,
  });
  y -= 14;
  page.drawText(`Naam: ${input.klant.fullName}`, {
    x: marginX,
    y,
    size: 10,
    font: helv,
    color: black,
  });
  y -= 13;
  page.drawText(`E-mail: ${input.klant.email}`, {
    x: marginX,
    y,
    size: 10,
    font: helv,
    color: black,
  });
  y -= 13;
  page.drawText(
    `Adres: ${input.klant.address?.trim() || "____________________________________________ (vul in)"}`,
    { x: marginX, y, size: 10, font: helv, color: black },
  );
  y -= 24;

  // Gemachtigde-blok
  page.drawText("Gemachtigde:", {
    x: marginX,
    y,
    size: 10,
    font: helvBold,
    color: black,
  });
  y -= 14;
  page.drawText(`${TECHZ_NAAM}`, {
    x: marginX,
    y,
    size: 10,
    font: helv,
    color: black,
  });
  y -= 13;
  page.drawText(`KvK ${TECHZ_KVK} · ${TECHZ_EMAIL}`, {
    x: marginX,
    y,
    size: 10,
    font: helv,
    color: black,
  });
  y -= 26;

  // Body — wrap manual op 80-char width
  const body = bodyText(
    input.claimType,
    input.klant.fullName,
    input.zaakIdentifier,
    input.uitgifteDatum,
    addMonths(input.uitgifteDatum, 12),
  );

  const wrappedLines = wrapText(body, 95);
  for (const line of wrappedLines) {
    if (y < 180) break; // ruimte reserveren voor handtekening-blok
    page.drawText(line, {
      x: marginX,
      y,
      size: 9.5,
      font: helv,
      color: black,
    });
    y -= 13;
  }

  // Handtekening-blok onderaan
  const sigY = 130;
  page.drawText("Plaats:", {
    x: marginX,
    y: sigY,
    size: 10,
    font: helvBold,
    color: black,
  });
  page.drawLine({
    start: { x: marginX + 50, y: sigY - 2 },
    end: { x: marginX + 240, y: sigY - 2 },
    thickness: 0.5,
    color: grey,
  });

  page.drawText("Datum:", {
    x: marginX + 260,
    y: sigY,
    size: 10,
    font: helvBold,
    color: black,
  });
  page.drawLine({
    start: { x: marginX + 305, y: sigY - 2 },
    end: { x: marginX + 460, y: sigY - 2 },
    thickness: 0.5,
    color: grey,
  });

  page.drawText("Handtekening:", {
    x: marginX,
    y: sigY - 40,
    size: 10,
    font: helvBold,
    color: black,
  });
  page.drawLine({
    start: { x: marginX, y: sigY - 80 },
    end: { x: marginX + 280, y: sigY - 80 },
    thickness: 0.5,
    color: grey,
  });
  page.drawText(`(${input.klant.fullName})`, {
    x: marginX,
    y: sigY - 95,
    size: 9,
    font: helv,
    color: grey,
  });

  // Footer
  page.drawText(
    `Zaak-identifier: ${input.zaakIdentifier} · Uitgegeven: ${input.uitgifteDatum.toLocaleDateString("nl-NL")} · DeGeldHeld v36`,
    {
      x: marginX,
      y: 40,
      size: 8,
      font: helv,
      color: grey,
    },
  );

  return doc.save();
}

/**
 * addMonths woont sinds v40 in lib/date-utils.ts (dependency-vrij, zodat
 * client-side modules 'm kunnen gebruiken zonder pdf-lib mee te bundelen).
 * Hier ge-re-exporteerd omdat bestaande callers + tests dit pad gebruiken.
 */
export { addMonths } from "@/lib/date-utils";

/** Eenvoudige greedy word-wrap (op woord-grens) naar regels van max `width` tekens. */
function wrapText(text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      result.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let line = "";
    for (const w of words) {
      if (line.length === 0) {
        line = w;
      } else if (line.length + 1 + w.length > width) {
        result.push(line);
        line = w;
      } else {
        line += " " + w;
      }
    }
    if (line.length > 0) result.push(line);
  }
  return result;
}
