/**
 * lib/inbound-verify.ts — Resend inbound webhook signature verification.
 *
 * Resend signs webhooks with **Svix**, not a bare hex HMAC. Each delivery
 * carries three headers — `svix-id`, `svix-timestamp`, `svix-signature` —
 * and the signed content is `${svix-id}.${svix-timestamp}.${rawBody}`,
 * HMAC-SHA256'd with the endpoint secret (`whsec_…`). The svix lib also
 * enforces a timestamp tolerance (replay protection) and supports key
 * rotation (multiple space-separated signatures), so we delegate to it
 * rather than re-implementing the scheme by hand — re-implementing it
 * wrong is exactly the bug this sprint fixes.
 *
 * One secret for all inbound: Resend routes every inbound email for the
 * domain to a single webhook endpoint with a single signing secret. We use
 * `RESEND_WEBHOOK_SECRET` everywhere; the old per-path secrets
 * (RESEND_PROOF_WEBHOOK_SECRET / RESEND_INBOUND_SECRET) are retired.
 */
import { Webhook } from "svix";

export function verifyResendWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false; // never accept unsigned
  try {
    new Webhook(secret).verify(rawBody, {
      "svix-id": headers.get("svix-id") ?? "",
      "svix-timestamp": headers.get("svix-timestamp") ?? "",
      "svix-signature": headers.get("svix-signature") ?? "",
    });
    return true;
  } catch {
    return false;
  }
}
