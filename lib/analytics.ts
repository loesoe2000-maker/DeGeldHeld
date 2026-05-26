/**
 * lib/analytics.ts — typed, privacy-safe funnel analytics (PostHog).
 *
 * HARD RULE: never pass PII (no invoice text, email, name, customer number,
 * tokens). Only funnel steps + coarse, non-identifying props (category,
 * provider, booleans, rounded amounts). track()/identify() are no-ops until
 * the PostHog provider initialises (which itself no-ops without a key), so
 * importing this anywhere — incl. SSR — is always safe.
 */
import posthog from "posthog-js";

export type AnalyticsEvent =
  | "landing_view"
  | "upload_started"
  | "upload_succeeded"
  | "upload_failed"
  | "analyse_viewed"
  | "ocr_corrected"
  | "email_generated"
  | "fee_card_linked"
  | "relay_authorized"
  | "email_copied"
  | "email_sent"
  | "outcome_marked"
  | "proof_submitted"
  // v28 geld-check (toeslagen + gemeente) — geen PII
  | "geld_check_started"
  | "geld_check_results_viewed"
  | "geld_check_aanvraag_clicked"
  // v28 funnel — kruisverwijzing van de geld-check naar de rekeningen-flow
  | "geld_check_to_onderhandel"
  // v28 EU261 vluchtclaim (achter FEATURE_CLAIMS) — geen PII
  | "vluchtclaim_checked"
  // v30 PostCheckCta — meetbare conversie van gratis-check naar Plus / onderhandeling.
  | "plus_cta_clicked"
  | "onderhandel_cta_clicked"
  // v29 Box 3-rechtsherstel (achter FEATURE_BOX3_CHECK_ENABLED) — geen PII
  | "box3_check_started"
  | "box3_results_viewed"
  | "box3_ncnp_chosen"
  | "box3_diy_chosen"
  // v30 Box 3 proof-back NCNP-loop — geen PII
  | "box3_claim_created"
  | "box3_proof_uploaded"
  | "box3_fee_charged"
  | "box3_proof_failed"
  // v29 NS Geld-Terug bij vertraging (achter FEATURE_NS_CHECK_ENABLED)
  | "ns_check_started"
  | "ns_results_viewed"
  | "ns_reminder_set"
  // v29 Zorgkostenaftrek (achter FEATURE_ZORGKOSTEN_CHECK_ENABLED)
  | "zorgkosten_check_started"
  | "zorgkosten_results_viewed"
  // v29 vind-al-je-geld hub (achter FEATURE_MONEYFINDER_HUB_ENABLED)
  | "moneyfinder_hub_view"
  | "moneyfinder_hub_tile_clicked"
  // v35 Huurcommissie-bezwaar servicekosten (achter HUURCOMMISSIE_CHECK_ENABLED)
  | "huurcommissie_check_started"
  | "huurcommissie_results_viewed"
  | "huurcommissie_ncnp_chosen"
  | "huurcommissie_diy_chosen"
  | "huurcommissie_uitspraak_uploaded"
  // v35 Energie-eindafrekening-claim (achter ENERGIE_CLAIM_CHECK_ENABLED)
  | "energie_claim_check_started"
  | "energie_claim_results_viewed"
  | "energie_claim_ncnp_chosen"
  | "energie_claim_diy_chosen"
  | "energie_claim_uitspraak_uploaded";

/** Only non-PII primitives. provider/category are business categoricals, not PII. */
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

let _enabled = false;

/** Flipped on by the PostHog provider once init succeeds. */
export function setAnalyticsEnabled(v: boolean): void {
  _enabled = v;
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === "undefined" || !_enabled) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* analytics must never break the app */
  }
}

/** Associate the anonymous session with a user id (NEVER the email). */
export function identify(userId: string): void {
  if (typeof window === "undefined" || !_enabled || !userId) return;
  try {
    posthog.identify(userId);
  } catch {
    /* no-op */
  }
}

/**
 * Strip query strings from a captured URL so bill ids / tokens (?bill=,
 * ?token=) never leak into analytics. Pure + exported for tests.
 */
export function sanitizeAnalyticsUrl(url: unknown): unknown {
  if (typeof url !== "string") return url;
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

/**
 * sanitize_properties hook for posthog.init — redacts URL query strings on
 * every captured event (defence-in-depth against PII in URLs).
 */
export function sanitizeAnalyticsProperties(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...props };
  for (const k of ["$current_url", "$referrer", "$pathname", "$initial_current_url"]) {
    if (k in out) out[k] = sanitizeAnalyticsUrl(out[k]);
  }
  return out;
}
