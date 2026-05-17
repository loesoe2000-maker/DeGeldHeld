/**
 * lib/schemas/index.ts
 *
 * Central Zod schemas for every `/api/**` mutation endpoint.
 *
 * Why centralised: keeps validation logic out of route handlers, lets
 * tests target schemas directly, and gives one place to update when
 * shapes evolve.
 */
import { z } from "zod";

export { emailSchema, waitlistSchema, isValidEmail } from "../validation";
export type { WaitlistInput } from "../validation";

/** /api/checkout — POST body */
export const checkoutSchema = z.object({
  negotiationId: z.string().min(1, "negotiationId vereist"),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** /api/negotiations/sent — POST body (either id may be supplied) */
export const negotiationSentSchema = z
  .object({
    negotiationId: z.string().min(1).optional(),
    billId: z.string().min(1).optional(),
  })
  .refine((d) => d.negotiationId || d.billId, {
    message: "negotiationId of billId vereist",
  });
export type NegotiationSentInput = z.infer<typeof negotiationSentSchema>;

/** /api/negotiations/outcome — POST body */
export const negotiationOutcomeSchema = z.object({
  negotiationId: z.string().min(1, "negotiationId vereist"),
  outcome: z.enum(["SUCCESS_SAVED", "FAILED_NO_DEAL", "STILL_WAITING"]),
  actualSavingsCents: z.number().int().min(0).optional(),
  token: z.string().optional(),
});
export type NegotiationOutcomeInput = z.infer<typeof negotiationOutcomeSchema>;

/**
 * /api/negotiations/round — JSON body shape. The route also accepts
 * multipart/form-data with an OCR screenshot; that path is validated
 * by hand in the route because Zod can't pre-parse FormData.
 */
export const negotiationRoundSchema = z.object({
  negotiationId: z.string().min(1, "negotiationId vereist"),
  providerResponse: z.string().max(20_000).optional(),
});
export type NegotiationRoundInput = z.infer<typeof negotiationRoundSchema>;

/** /api/providers/discover — POST body */
export const providerDiscoverSchema = z.object({
  name: z.string().min(2, "Naam te kort").max(120, "Naam te lang"),
  country: z.string().min(2).max(3).toUpperCase(),
});
export type ProviderDiscoverInput = z.infer<typeof providerDiscoverSchema>;

/** /api/providers/candidates/[id] — PATCH body */
export const providerCandidatePatchSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});
export type ProviderCandidatePatchInput = z.infer<
  typeof providerCandidatePatchSchema
>;

/**
 * Format a Zod error into a single user-visible NL message.
 * Picks the first issue so we always have *something* useful.
 */
export function firstIssueMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Ongeldige invoer";
  return issue.message || "Ongeldige invoer";
}
