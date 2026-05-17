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
