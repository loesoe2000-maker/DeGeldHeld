/**
 * lib/relay-providers.ts — v25 sourced provider retention/customer-service
 * email registry for the relay (negotiate-on-behalf).
 *
 * GUARDRAIL 5 — NO hallucinated addresses. Every entry below was confirmed by
 * fetching the provider's OFFICIAL contact page; each carries a `// bron: <URL>`
 * comment naming that page. A provider whose official site shows ONLY a
 * phone/chat/contact-form (no public email) is deliberately ABSENT here — the
 * consent UI then asks the customer to type the address from their invoice
 * (manual fallback). Never guess an address to "fill the gap".
 *
 * Keys are canonical provider names from lib/providers.ts; lookup is
 * case-insensitive. Verified 2026-05-21.
 */

type RelayProviderEntry = { provider: string; email: string };

/**
 * Only the big NL telecom/internet/energie providers whose official contact
 * page publishes a real customer-service email. Each line names its bron.
 */
const RELAY_PROVIDER_EMAILS: RelayProviderEntry[] = [
  { provider: "Vattenfall", email: "vattenfall@vattenfall.nl" }, // bron: https://www.vattenfall.nl/service/contact/
  { provider: "Greenchoice", email: "vragen@greenchoice.nl" }, // bron: https://www.greenchoice.nl/klantenservice/contact
  { provider: "Pure Energie", email: "info@pure-energie.nl" }, // bron: https://www.pure-energie.nl/klantenservice/
  { provider: "Engie", email: "klantenservice.nl@engie.com" }, // bron: https://www.engie.nl/klantenservice
  { provider: "Freedom Internet", email: "helpdesk@freedomnet.nl" }, // bron: https://www.freedom.nl/contact
  // Bewust WEGGELATEN (officiële site toont géén publiek e-mailadres, alleen
  // app/chat/telefoon/formulier → handmatige invoer in de consent-UI):
  // KPN, Vodafone, Odido, Ziggo, Tele2, Simyo, Ben, Eneco, Essent,
  // Frank Energie, Vandebron (e-mail link-masked), Energiedirect, Oxxio.
];

/** Case-insensitive lookup → verified provider email, or null when unknown. */
export function relayProviderEmail(providerCanonical: string): string | null {
  const needle = (providerCanonical ?? "").trim().toLowerCase();
  if (!needle) return null;
  const hit = RELAY_PROVIDER_EMAILS.find((e) => e.provider.toLowerCase() === needle);
  return hit ? hit.email : null;
}

/** Test/diagnostics helper — the raw verified registry. */
export function relayProviderRegistry(): ReadonlyArray<RelayProviderEntry> {
  return RELAY_PROVIDER_EMAILS;
}
