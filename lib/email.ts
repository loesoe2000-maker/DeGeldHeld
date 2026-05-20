import { Resend } from "resend";
import { welcomeBrandedHtml } from "@/lib/email_templates";
import { EMAIL_FROM } from "@/lib/email-from";

const apiKey = process.env.RESEND_API_KEY ?? "";
const from = EMAIL_FROM;

let _resend: Resend | null = null;
function client() {
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}) {
  if (!apiKey || apiKey === "re_test_dummy") {
    return { id: "test-noop", skipped: true };
  }
  const result = await client().emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    headers: opts.headers,
  });
  return { id: result.data?.id ?? "unknown", skipped: false };
}

export function welcomeEmailHtml(email: string) {
  // Backwards-compat alias — delegates to branded template.
  return welcomeBrandedHtml(email);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
