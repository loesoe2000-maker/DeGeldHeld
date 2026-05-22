/**
 * lib/relay-providers.ts — v25/v26 sourced provider retention/customer-service
 * email registry for the relay (negotiate-on-behalf).
 *
 * GUARDRAIL — NO hallucinated addresses. Every address below was confirmed by
 * fetching the provider's OFFICIAL contact page; each carries a `// bron: <URL>`
 * comment naming that page. A provider whose official site shows ONLY a
 * phone/chat/contact-form (no public email) is NOT given an address — it lives
 * in RELAY_NO_EMAIL_PROVIDERS so the UI can set an honest expectation, and the
 * customer types the address from their invoice (manual fallback). Never guess
 * an address to "fill the gap".
 *
 * Keys are canonical provider names from lib/providers.ts; lookup is
 * case-insensitive. Verified 2026-05-21 (v25) / 2026-05-22 (v26).
 */

type RelayProviderEntry = { provider: string; email: string };

/** What channel can the relay use to reach this provider? */
export type RelayChannel = "email" | "no-email" | "unknown";

/**
 * Providers whose official contact page publishes a real customer-service
 * email. Each line names its bron.
 */
const RELAY_PROVIDER_EMAILS: RelayProviderEntry[] = [
  { provider: "Vattenfall", email: "vattenfall@vattenfall.nl" }, // bron: https://www.vattenfall.nl/service/contact/
  { provider: "Greenchoice", email: "vragen@greenchoice.nl" }, // bron: https://www.greenchoice.nl/klantenservice/contact
  { provider: "Pure Energie", email: "info@pure-energie.nl" }, // bron: https://www.pure-energie.nl/klantenservice/
  { provider: "Engie", email: "klantenservice.nl@engie.com" }, // bron: https://www.engie.nl/klantenservice
  { provider: "Freedom Internet", email: "helpdesk@freedomnet.nl" }, // bron: https://www.freedom.nl/contact
];

type RelayNoEmailEntry = { provider: string; note: string };

/**
 * Providers whose OFFICIAL site shows NO public email for service/negotiation
 * (only app/phone/chat/form) — confirmed by WebFetch. The relay UI uses this to
 * be honest ("e-mail werkt hier minder goed") instead of pretending. Each line
 * names its bron. Verified 2026-05-21 / 2026-05-22.
 *
 * NB: providers we could NOT verify (403/obfuscated address) are deliberately
 * NOT listed here — they stay "unknown" → manual entry, never assumed.
 */
const RELAY_NO_EMAIL_PROVIDERS: RelayNoEmailEntry[] = [
  // Telecom/mobiel/internet — app/telefoon/formulier, geen publiek e-mailadres.
  { provider: "KPN", note: "KPN behandelt service/onderhandeling via telefoon, chat en de app — geen publiek e-mailadres." }, // bron: https://www.kpn.com/service/contact.htm
  { provider: "Vodafone", note: "Vodafone werkt via telefoon, chat en formulier — geen publiek e-mailadres." }, // bron: https://www.vodafone.nl/service/contact
  { provider: "Odido", note: "Odido werkt via de app, chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.odido.nl/klantenservice
  { provider: "Ziggo", note: "Ziggo werkt via de app, chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.ziggo.nl/klantenservice/contact
  { provider: "Simyo", note: "Simyo werkt via de app en telefoon — geen publiek e-mailadres." }, // bron: https://www.simyo.nl/klantenservice
  { provider: "Tele2", note: "Tele2 werkt via de app, chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.tele2.nl/klantenservice
  { provider: "Youfone", note: "Youfone werkt via chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.youfone.nl/klantenservice
  { provider: "Hollandsnieuwe", note: "hollandsnieuwe werkt via chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.hollandsnieuwe.nl/klantenservice
  { provider: "Budget Mobiel", note: "Budget Mobiel werkt via chat, telefoon en formulier — geen publiek e-mailadres." }, // bron: https://www.budgetthuis.nl/mobiel/klantenservice
  // Energie — app/telefoon/formulier, geen publiek e-mailadres.
  { provider: "Eneco", note: "Eneco werkt via de app, Mijn Eneco en telefoon — geen publiek e-mailadres." }, // bron: https://www.eneco.nl/klantenservice/contact/
  { provider: "Essent", note: "Essent werkt via de app, chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.essent.nl/klantenservice/contact
  { provider: "Frank Energie", note: "Frank Energie werkt via WhatsApp, telefoon en formulier — geen publiek e-mailadres." }, // bron: https://www.frankenergie.nl/contact
  { provider: "Energiedirect", note: "Energiedirect werkt via de app, chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.energiedirect.nl/klantenservice/contact
  { provider: "Oxxio", note: "Oxxio werkt via de app, chat en telefoon — geen publiek e-mailadres." }, // bron: https://www.oxxio.nl/klantenservice
  { provider: "Budget Energie", note: "Budget Energie werkt via chat, telefoon en formulier — geen publiek e-mailadres." }, // bron: https://www.budgetthuis.nl/klantenservice
];

/** Case-insensitive lookup → verified provider email, or null when unknown. */
export function relayProviderEmail(providerCanonical: string): string | null {
  const needle = (providerCanonical ?? "").trim().toLowerCase();
  if (!needle) return null;
  const hit = RELAY_PROVIDER_EMAILS.find((e) => e.provider.toLowerCase() === needle);
  return hit ? hit.email : null;
}

/**
 * Which channel does the relay have for this provider?
 *   - "email"    → verified address in the registry (relay can mail directly).
 *   - "no-email" → official site has no public email (UI sets honest
 *                  expectation; customer may still type an address they have).
 *   - "unknown"  → not researched / could not verify → manual entry required.
 */
export function relayProviderChannel(providerCanonical: string): RelayChannel {
  const needle = (providerCanonical ?? "").trim().toLowerCase();
  if (!needle) return "unknown";
  if (RELAY_PROVIDER_EMAILS.some((e) => e.provider.toLowerCase() === needle)) return "email";
  if (RELAY_NO_EMAIL_PROVIDERS.some((e) => e.provider.toLowerCase() === needle)) return "no-email";
  return "unknown";
}

/** The honest "no public email" note for a provider, or null. */
export function relayNoEmailNote(providerCanonical: string): string | null {
  const needle = (providerCanonical ?? "").trim().toLowerCase();
  if (!needle) return null;
  const hit = RELAY_NO_EMAIL_PROVIDERS.find((e) => e.provider.toLowerCase() === needle);
  return hit ? hit.note : null;
}

/** Test/diagnostics helpers — the raw verified registries. */
export function relayProviderRegistry(): ReadonlyArray<RelayProviderEntry> {
  return RELAY_PROVIDER_EMAILS;
}
export function relayNoEmailRegistry(): ReadonlyArray<RelayNoEmailEntry> {
  return RELAY_NO_EMAIL_PROVIDERS;
}
