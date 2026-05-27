/**
 * lib/user-documents.ts — v36 idee 4 — Document-vault helpers.
 *
 * Pure validation + categorisatie. De upload-route in
 * app/api/account/documents/upload uses these helpers; tests dekken alle
 * branches zonder Vercel Blob aan te raken.
 */

// ─── Categorieën ────────────────────────────────────────────────────────────

export const DOCUMENT_KINDS = [
  "huurcontract",
  "energiecontract",
  "loonstrook",
  "aangifte",
  "beschikking",
  "jaarafrekening",
  "overig",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Nederlandse labels voor de UI. */
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  huurcontract: "Huurcontract",
  energiecontract: "Energiecontract",
  loonstrook: "Loonstrook",
  aangifte: "Aangifte inkomstenbelasting",
  beschikking: "Beschikking (Belastingdienst)",
  jaarafrekening: "Jaarafrekening (huur of energie)",
  overig: "Overig",
};

/** Korte uitleg bij elke kind voor de upload-pagina. */
export const DOCUMENT_KIND_HINT: Record<DocumentKind, string> = {
  huurcontract:
    "Je huurovereenkomst. Gebruiken we voor Huurcommissie-claims (boekjaar + verhuurder uit het contract).",
  energiecontract:
    "Je leveringsovereenkomst met energieleverancier. Voor energie-claims (contractvoorwaarden).",
  loonstrook:
    "Recente loonstrook of jaaropgave. Voor inkomen-gebaseerde checks (toeslagen, zorgkostenaftrek).",
  aangifte:
    "Je ingediende aangifte inkomstenbelasting. Voor Box 3-rechtsherstel + zorgkosten-controle.",
  beschikking:
    "Beschikking van de Belastingdienst. Sluiting van een Box 3-claim of toeslag-besluit.",
  jaarafrekening:
    "Jaarafrekening servicekosten (huur) of energie-eindafrekening. Basis voor de claim-berekening.",
  overig: "Iets anders dat relevant kan zijn voor je claims.",
};

export function isDocumentKind(s: unknown): s is DocumentKind {
  return typeof s === "string" && (DOCUMENT_KINDS as ReadonlyArray<string>).includes(s);
}

// ─── Upload-validation ──────────────────────────────────────────────────────

/** Toegestane MIME-types: PDF + JPG + PNG. Voldoende voor 99% van use-cases. */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Max 10 MB — fits binnen Vercel Blob free tier + redelijk voor PDFs. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Max bestandsnaam-lengte (255 = OS-norm). */
export const MAX_FILENAME_LENGTH = 255;

export type UploadValidationInput = {
  kind: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  note?: string | null;
};

export type UploadValidationResult =
  | { ok: true; kind: DocumentKind; filename: string; mimeType: AllowedMimeType }
  | { ok: false; error: string };

/**
 * Validate één upload-poging. Pure functie — geen IO.
 * Geeft de eerste fout terug zodat de UI één duidelijke melding kan tonen.
 */
export function validateUpload(input: UploadValidationInput): UploadValidationResult {
  if (!isDocumentKind(input.kind)) {
    return { ok: false, error: "Onbekende document-categorie." };
  }
  if (typeof input.filename !== "string" || input.filename.trim().length === 0) {
    return { ok: false, error: "Bestandsnaam ontbreekt." };
  }
  if (input.filename.length > MAX_FILENAME_LENGTH) {
    return { ok: false, error: "Bestandsnaam is te lang (max 255 tekens)." };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "Bestand is leeg." };
  }
  if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    const mb = (input.sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `Bestand is te groot (${mb} MB, max 10 MB).`,
    };
  }
  if (!(ALLOWED_MIME_TYPES as ReadonlyArray<string>).includes(input.mimeType)) {
    return {
      ok: false,
      error: "Bestandstype niet toegestaan. Upload een PDF, JPG of PNG.",
    };
  }
  if (input.note != null && input.note.length > 500) {
    return { ok: false, error: "Toelichting is te lang (max 500 tekens)." };
  }
  return {
    ok: true,
    kind: input.kind,
    filename: input.filename,
    mimeType: input.mimeType as AllowedMimeType,
  };
}

// ─── Blob-pad ───────────────────────────────────────────────────────────────

/**
 * Bouw een Vercel-Blob-pad. UserId in het pad → makkelijke owner-prefix-listing
 * (al gebruiken we Prisma als bron-van-waarheid, niet de blob-listing).
 *
 * Het pad zelf is GEEN security-mechanisme: Vercel Blob URLs hebben een
 * cryptografisch random suffix. Maar de prefix maakt admin-audit makkelijker.
 */
export function buildBlobPath(userId: string, filename: string): string {
  // Strip path-separators + parent-refs uit de filename voor de zekerheid.
  // Vercel Blob escapeert dit zelf óók nog, maar defense in depth.
  const safeName = filename
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "__");
  return `user-documents/${userId}/${Date.now()}-${safeName}`;
}

// ─── Display-helpers ────────────────────────────────────────────────────────

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
