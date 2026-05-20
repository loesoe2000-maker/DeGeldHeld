/**
 * Single source of truth for the outgoing e-mail from-address.
 *
 * Every outbound mail — magic-links (NextAuth/Resend) and transactional
 * mail (lib/email.ts) — must use the SAME verified-domain sender. A
 * resend.dev test sender (or a mismatched domain) lands magic-links in
 * spam and silently kills signups, so we enforce one constant here.
 *
 * The address must be on the domain whose SPF/DKIM/DMARC are verified in
 * Resend (degeldheld.com). EMAIL_FROM can override it (e.g. a sub-sender
 * like onboarding@), but the default stays on the verified apex.
 */
export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "DeGeldHeld <hallo@degeldheld.com>";

/** Extract the bare e-mail address from a "Name <addr@domain>" string. */
export function fromAddress(from = EMAIL_FROM): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/** The domain portion of the from-address — used by health checks. */
export function fromDomain(from = EMAIL_FROM): string {
  const addr = fromAddress(from);
  const at = addr.lastIndexOf("@");
  return at >= 0 ? addr.slice(at + 1).toLowerCase() : "";
}

/**
 * A resend.dev sender is the unverified test domain — fine locally, but a
 * production deliverability footgun. Health checks surface this.
 */
export function isTestSender(from = EMAIL_FROM): boolean {
  return fromDomain(from).endsWith("resend.dev");
}
