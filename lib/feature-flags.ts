/**
 * lib/feature-flags.ts — central flag registry.
 *
 * Defaults are chosen so a fresh deployment is "stable subset" — risky
 * or experimental features off, proven features on. Each flag is a
 * single env var that Vercel can flip without a code deploy.
 *
 * Emergency rollback procedure: see RUNBOOK.md "Emergency rollback".
 */

const FLAG_DEFAULTS = {
  // Off by default — needs external account / DPA / DPIA
  PSD2_ENABLED: false,
  // Off by default — needs Twilio WhatsApp Business approval
  WHATSAPP_ENABLED: false,
  // On by default — v5 round-flow proven in v7+
  MULTI_ROUND_ENABLED: true,
  // On by default — PDF text extraction via pdfjs proven on prod (v7)
  PDF_OCR_ENABLED: true,
  // On by default — €4.99 paywall after first free bill
  PAYWALL_ENABLED: true,
  // On by default — Resend inbound mail-forward (v8)
  EMAIL_INBOUND_ENABLED: true,
  // On by default — referral viral loop (v7)
  REFERRAL_ENABLED: true,
  // Off by default — auto-pingpong needs proven Resend inbound + 5
  // tested threads before flipping. User-confirm gate is mandatory.
  AUTO_PINGPONG: false,
  // Off by default — v11 revenue verification. Once on, /api/inbound/proof
  // accepts forwarded provider confirmations and proof-flow gates count
  // toward verified savings.
  PROOF_REQUIRED: false,
  // Off by default — v11 no-cure-no-pay charging. Only flip after 5
  // real verified-savings flows confirmed end-to-end. Without this,
  // legacy paywall stays in place.
  NO_CURE_NO_PAY: false,
  // Off by default — v25 negotiate-on-behalf RELAY. Gates EVERY relay
  // entrypoint (consent-prompt visibility, relay-authorize, the status
  // page, relay-approve, relay-pause). MUST stay off until a lawyer has
  // reviewed the volmacht + voorwaarden + privacy (docs/MACHTIGING.md).
  // Off → only the existing manual copy-to-send flow, zero relay UI.
  RELAY_ENABLED: false,
  // Off by default — v28 gratis "vind al je geld"-check (toeslagen +
  // gemeente-regelingen). Pure indicatie, geen DigiD/opslag. Flip aan zodra
  // owner de privacy-tekst + indicatie-disclaimer heeft gereviewed (zie
  // GELD_CHECK_DISCLAIMER in lib/toeslagen.ts). Gates het /geld-check
  // entrypoint + de dashboard/landing-tile.
  GELD_CHECK_ENABLED: false,
  // Off by default — v28 EU261 vluchtclaim-check + no-cure-no-pay claim-flow.
  // Achter deze flag tot:
  //   1. flight-data-API key (Aviation Edge / AviationStack) is ingericht
  //   2. juridische check op de volmacht/claim-brief is afgerond
  // De pure berekening (lib/eu261.ts) staat los en is altijd testbaar.
  CLAIMS: false,
  // Off by default — v29 Box 3-rechtsherstel check + brief-helper (Wet
  // tegenbewijsregeling, juli 2025). Pure indicatie + DIY-brief; NCNP-aanbod
  // alléén bij verwachte teruggave ≥ € 500 (guardrail). Flip aan na
  // privacy/disclaimer-review eigenaar.
  BOX3_CHECK_ENABLED: false,
  // Off by default — v29 NS Geld-Terug bij Vertraging check + brief.
  // Pure indicatie + DIY; auto-claim is een Plus-positionering (geen
  // achtergrond-job in deze sprint). Flip aan na review NS-voorwaarden-tekst.
  NS_CHECK_ENABLED: false,
  // Off by default — v29 zorgkostenaftrek indicatie + checklist veelvergeten
  // posten. Drempel-formule sourced uit Belastingdienst. Géén exact
  // belastingvoordeel in EUR (hangt af van marginaal tarief). Flip aan na
  // review aftrek-disclaimer.
  ZORGKOSTEN_CHECK_ENABLED: false,
  // Off by default — v29 centrale "vind al je geld"-hub die toeslagen/Box 3/
  // zorgkosten/vluchtclaim/NS/spookabonnementen bij elkaar brengt. Tegels
  // verschijnen alleen als hun eigen flag aan staat (geen lege/dode UI).
  MONEYFINDER_HUB_ENABLED: false,
  // Off by default — v30 Plus maandelijkse her-scan cron. Mag pas aan zodra
  // owner CRON_SECRET in Vercel heeft gezet + Resend-template gereviewed +
  // KvK/KYC rond is (anders zijn er geen active Plus-users om te scannen).
  PLUS_RESCAN_CRON_ENABLED: false,
  // Off by default — v35 Huurcommissie-bezwaar servicekosten check + DIY-brief
  // + NCNP-claim ≥ € 50. Bron-discipline: docs/V35_DATA_2026.md. Flip aan na
  // privacy/disclaimer-review eigenaar.
  HUURCOMMISSIE_CHECK_ENABLED: false,
  // Off by default — v35 Energie-eindafrekening-claim via Geschillencommissie
  // Energie. Rode-vlag-detector + DIY-klachtbrief + NCNP-claim ≥ € 50. Flip aan
  // na privacy/disclaimer-review + verificatie energiebelasting-vermindering 2026.
  ENERGIE_CLAIM_CHECK_ENABLED: false,
  // Off by default — v36 idee 4 — UserDocument-vault. Klant uploadt huurcontract,
  // energiecontract, loonstrook, aangifte, beschikking één keer en kan deze
  // hergebruiken in elke claim/check. MAG NIET AAN voordat:
  //  (a) BLOB_READ_WRITE_TOKEN in Vercel-env staat (Vercel Blob)
  //  (b) Privacy-tekst is gereviewed (AVG art. 6 lid 1b — uitvoering NCNP)
  //  (c) Retention-policy is bevestigd (default: tot account-deletion of 7 jr
  //      voor fiscaal-relevante stukken zoals aangifte/beschikking)
  DOCUMENTS_VAULT_ENABLED: false,
  // Off by default — v36 idee 2 — digitale volmacht via SES (typed name +
  // IP-hash + timestamp). eIDAS-laagste niveau (Simple Electronic Signature).
  // NIET geschikt voor Box 3 (DigiD-vereist via Belastingdienst); WEL voor
  // huurcommissie + energie-claim. MAG NIET AAN voordat:
  //  (a) Lawyer de volmacht-template heeft gereviewed
  //  (b) Privacy-tekst is gereviewed (AVG art. 6 lid 1b)
  //  (c) VOLMACHT_IP_HASH_SECRET env-var is gezet
  VOLMACHT_SES_ENABLED: false,
  // Off by default — v37 — dagelijkse deadline-nudge-cron voor huur+energie
  // claims (verstuur-je-brief / reactie-verlopen / behandeling-traag). Flip aan
  // zodra CRON_SECRET in Vercel staat + de nudge-mailteksten gereviewd zijn.
  // Respecteert marketingOptOut + notificationsEnabled (geen spam).
  CLAIM_DEADLINE_NUDGE_ENABLED: false,
} as const;

export type FeatureFlag = keyof typeof FLAG_DEFAULTS;

/**
 * Read a feature flag. Env var name = `FEATURE_<flag>`. Values:
 *   - "true" → enabled
 *   - "false" → disabled
 *   - unset  → use the default for that flag
 *
 * Examples:
 *   FEATURE_PSD2_ENABLED=true       → PSD2 turns on
 *   FEATURE_PAYWALL_ENABLED=false   → paywall switched off
 */
export function isEnabled(flag: FeatureFlag): boolean {
  const envName = `FEATURE_${flag}`;
  const v = process.env[envName];
  if (v === "true") return true;
  if (v === "false") return false;
  return FLAG_DEFAULTS[flag];
}

/** Snapshot of every flag's current state (for /api/health + admin). */
export function snapshot(): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>;
  for (const key of Object.keys(FLAG_DEFAULTS) as FeatureFlag[]) {
    out[key] = isEnabled(key);
  }
  return out;
}

export { FLAG_DEFAULTS };
