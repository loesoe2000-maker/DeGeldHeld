import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  GROQ_VISION_MODEL: z.string().default("llama-3.2-90b-vision-preview"),
  GROQ_TEXT_MODEL: z.string().default("llama-3.1-70b-versatile"),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  SENTRY_DSN: z.string().optional().default(""),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("DeGeldHeld"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(strict = true): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    if (strict) {
      const missing = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`ENV validation failed:\n${missing}`);
    }
    return schema.partial().parse(process.env) as Env;
  }
  return result.data;
}

export function envHealth(): { ok: boolean; missing: string[] } {
  const result = schema.safeParse(process.env);
  if (result.success) return { ok: true, missing: [] };
  return { ok: false, missing: result.error.issues.map((i) => i.path.join(".")) };
}
