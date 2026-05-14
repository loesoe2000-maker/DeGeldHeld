import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "E-mail te kort")
  .max(254, "E-mail te lang")
  .email("Ongeldig e-mailadres");

export function isValidEmail(s: unknown): s is string {
  return emailSchema.safeParse(s).success;
}

export const waitlistSchema = z.object({
  email: emailSchema,
  source: z.string().max(64).optional(),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
