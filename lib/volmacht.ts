/**
 * lib/volmacht.ts — v36 idee 2 — Digitale volmacht (SES) — PURE helpers.
 *
 * Eén ondertekend mandaat per claim. eIDAS-laagste niveau:
 *   - User typt zijn volledige naam (NIET geverifieerd tegen officieel ID)
 *   - User vinkt expliciet de mandaat-tekst aan
 *   - Server slaat de exacte tekst (versioneerd), timestamp, IP-hash op
 *
 * Geldigheid:
 *   - HuurServicekostenClaim (Huurcommissie-correspondentie)
 *   - EnergieEindafrekeningClaim (Geschillencommissie Energie + leverancier)
 *
 * NIET geldig voor Box 3 — Belastingdienst vereist DigiD/eHerkenning.
 *
 * Dit bestand bevat ALLEEN pure (browser-veilige) helpers — geen node:crypto
 * of fs imports. Voor de IP-hash zie lib/volmacht-server.ts.
 */

// ─── Types + constanten ─────────────────────────────────────────────────────

export const VOLMACHT_CLAIM_TYPES = [
  "HuurServicekostenClaim",
  "EnergieEindafrekeningClaim",
] as const;

export type VolmachtClaimType = (typeof VOLMACHT_CLAIM_TYPES)[number];

export function isVolmachtClaimType(s: unknown): s is VolmachtClaimType {
  return (
    typeof s === "string" &&
    (VOLMACHT_CLAIM_TYPES as ReadonlyArray<string>).includes(s)
  );
}

/** Huidige template-versie. Bump bij élke juridische wijziging. */
export const VOLMACHT_TEMPLATE_VERSION = "v1";

// ─── Mandaat-templates per claim-type ───────────────────────────────────────

/**
 * Bouw de exacte mandaat-tekst voor een specifieke (claim-type, full-name)
 * combinatie. Versioneerd: oude volmachten bewaren hun historische tekst
 * via Volmacht.mandateText + Volmacht.templateVersion.
 *
 * Concept-tekst — vóór GA juridisch laten toetsen (zie docs/MACHTIGING.md).
 */
export function volmachtMandateText(
  claimType: VolmachtClaimType,
  fullName: string,
): string {
  const naam = fullName.trim();
  const base =
    `Ik, ${naam}, machtig DeGeldHeld (handelsnaam van Techz B.V., KvK 84079398) ` +
    `om namens mij te corresponderen en juridische stappen te zetten in `;

  switch (claimType) {
    case "HuurServicekostenClaim":
      return (
        base +
        `mijn lopende bezwaar tegen de servicekosten-jaarafrekening bij mijn ` +
        `verhuurder en, indien nodig, bij de Huurcommissie. Deze volmacht is ` +
        `beperkt tot het bezwaar en de daaropvolgende Huurcommissie-procedure ` +
        `voor deze specifieke jaarafrekening. DeGeldHeld mag namens mij geen ` +
        `nieuw huurcontract of wijziging in het huidige huurcontract afsluiten. ` +
        `Ik kan deze volmacht op elk moment intrekken via een bericht aan ` +
        `hallo@degeldheld.com.`
      );
    case "EnergieEindafrekeningClaim":
      return (
        base +
        `mijn lopende klacht over mijn energie-eindafrekening bij mijn ` +
        `energieleverancier en, indien nodig, bij de Geschillencommissie ` +
        `Energie. Deze volmacht is beperkt tot deze specifieke ` +
        `eindafrekening. DeGeldHeld mag namens mij geen nieuw energiecontract ` +
        `afsluiten, geen leverancier wijzigen en geen contractwijziging ` +
        `accepteren. Ik kan deze volmacht op elk moment intrekken via een ` +
        `bericht aan hallo@degeldheld.com.`
      );
  }
}

// ─── Validatie van de sign-input ────────────────────────────────────────────

export type SignInput = {
  fullName: string;
  claimType: string;
  claimId: string;
  acceptedText: string;
};

export type SignValidation =
  | {
      ok: true;
      claimType: VolmachtClaimType;
      claimId: string;
      fullName: string;
      mandateText: string;
    }
  | { ok: false; error: string };

/**
 * Pure validation. UI laat de mandaat-tekst zien aan de gebruiker; bij submit
 * post't de UI dezelfde tekst terug (`acceptedText`) zodat we kunnen
 * verifiëren dat client + server dezelfde versie hadden. Mismatch → fout.
 */
export function validateSignInput(input: SignInput): SignValidation {
  if (!isVolmachtClaimType(input.claimType)) {
    return { ok: false, error: "Onbekend claim-type voor volmacht." };
  }
  if (typeof input.claimId !== "string" || input.claimId.trim().length === 0) {
    return { ok: false, error: "Claim-id ontbreekt." };
  }
  const naam = (input.fullName ?? "").trim();
  if (naam.length < 5) {
    return {
      ok: false,
      error: "Vul je volledige naam in (minstens 5 tekens).",
    };
  }
  if (naam.length > 100) {
    return { ok: false, error: "Naam is te lang (max 100 tekens)." };
  }
  if (!/\s/.test(naam)) {
    return {
      ok: false,
      error: "Vul je voor- én achternaam in (gescheiden door een spatie).",
    };
  }
  const expected = volmachtMandateText(input.claimType, naam);
  if ((input.acceptedText ?? "").trim() !== expected.trim()) {
    return {
      ok: false,
      error:
        "De mandaat-tekst komt niet overeen met de huidige versie. " +
        "Herlaad de pagina en probeer opnieuw.",
    };
  }
  return {
    ok: true,
    claimType: input.claimType,
    claimId: input.claimId,
    fullName: naam,
    mandateText: expected,
  };
}

// IP-hash zit in lib/volmacht-server.ts (server-only, node:crypto).
