import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY ?? "";
const from = process.env.EMAIL_FROM ?? "DeGeldHeld <hallo@degeldheld.com>";

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
  });
  return { id: result.data?.id ?? "unknown", skipped: false };
}

export function welcomeEmailHtml(email: string) {
  return `<!doctype html>
<html lang="nl"><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
<h1 style="color:#047857">Welkom bij DeGeldHeld 👋</h1>
<p>Hoi ${escapeHtml(email)},</p>
<p>Je staat op de wachtlijst! Zodra we openen krijg je een uitnodiging om je
eerste rekening te uploaden — wij onderhandelen voor je en je betaalt alleen
15% van wat we besparen.</p>
<p>Tot snel,<br/>Team DeGeldHeld</p>
</body></html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
