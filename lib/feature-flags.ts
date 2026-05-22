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
