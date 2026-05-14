/**
 * Branded HTML email templates — DeGeldHeld groen + wit.
 * Email-safe HTML: inline styles, tables for layout, no external CSS.
 */

import { escapeHtml } from "@/lib/email";

const BRAND_GREEN = "#059669";
const BRAND_GREEN_DARK = "#047857";
const SLATE_900 = "#0f172a";
const SLATE_600 = "#475569";
const SLATE_100 = "#f1f5f9";
const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

function shell(opts: { previewText: string; bodyContent: string }): string {
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>DeGeldHeld</title>
</head>
<body style="margin:0;padding:0;background:${SLATE_100};font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:${SLATE_900}">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">${escapeHtml(opts.previewText)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${SLATE_100};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
        <tr><td style="background:${BRAND_GREEN};padding:24px 32px;color:white">
          <div style="font-size:24px;font-weight:bold;letter-spacing:-0.5px">DeGeldHeld</div>
          <div style="font-size:13px;opacity:0.85;margin-top:4px">Houd je geld in eigen zak</div>
        </td></tr>
        <tr><td style="padding:32px">
          ${opts.bodyContent}
        </td></tr>
        <tr><td style="background:${SLATE_100};padding:20px 32px;font-size:12px;color:${SLATE_600};text-align:center">
          <div>© ${new Date().getFullYear()} DeGeldHeld B.V. — KvK 00000000</div>
          <div style="margin-top:4px"><a href="${APP_URL}" style="color:${SLATE_600};text-decoration:underline">degeldheld.com</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function welcomeBrandedHtml(email: string): string {
  return shell({
    previewText: "Welkom bij DeGeldHeld — je staat op de wachtlijst",
    bodyContent: `
      <h1 style="margin:0 0 16px;color:${BRAND_GREEN_DARK};font-size:24px">Welkom bij DeGeldHeld 🌱</h1>
      <p style="margin:0 0 16px;line-height:1.5">Hoi ${escapeHtml(email)},</p>
      <p style="margin:0 0 16px;line-height:1.5">Je staat op de wachtlijst. Zodra we openen sturen we je een uitnodiging om je
      eerste rekening te uploaden — wij onderhandelen voor je en je betaalt alleen <strong>15% van wat we besparen</strong>.</p>
      <p style="margin:0 0 24px;line-height:1.5">Tot snel,<br/>Team DeGeldHeld</p>
      <a href="${APP_URL}" style="display:inline-block;background:${BRAND_GREEN};color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Bekijk de website</a>
    `,
  });
}

export function magicLinkBrandedHtml(opts: { url: string; host: string }): string {
  return shell({
    previewText: "Klik hier om in te loggen bij DeGeldHeld",
    bodyContent: `
      <h1 style="margin:0 0 16px;color:${BRAND_GREEN_DARK};font-size:24px">Inloggen bij DeGeldHeld</h1>
      <p style="margin:0 0 16px;line-height:1.5">Klik op de knop om in te loggen. Deze link is 10 minuten geldig en kan maar één keer worden gebruikt.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(opts.url)}" style="display:inline-block;background:${BRAND_GREEN};color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px">Inloggen</a>
      </p>
      <p style="margin:16px 0;font-size:13px;color:${SLATE_600};line-height:1.5">Werkt de knop niet? Plak deze link in je browser:<br/>
        <span style="word-break:break-all;color:${SLATE_900}">${escapeHtml(opts.url)}</span></p>
      <p style="margin:16px 0;font-size:12px;color:${SLATE_600}">Heb je niet geprobeerd in te loggen? Negeer dan deze e-mail.</p>
    `,
  });
}

export type FollowUpInput = {
  customerName: string;
  provider: string;
  negotiationId: string;
  expectedSavingsCents?: number;
};

export function followUpBrandedHtml(i: FollowUpInput): string {
  const linkBase = `${APP_URL}/onderhandel/${i.negotiationId}/outcome`;
  const savingsLine = i.expectedSavingsCents && i.expectedSavingsCents > 0
    ? `<p style="margin:0 0 16px;line-height:1.5">Verwachte besparing was: <strong>€${(i.expectedSavingsCents / 100).toFixed(0)}/jaar</strong>.</p>`
    : "";
  return shell({
    previewText: `Wat was de uitkomst met ${i.provider}?`,
    bodyContent: `
      <h1 style="margin:0 0 16px;color:${BRAND_GREEN_DARK};font-size:24px">Hoe ging het met ${escapeHtml(i.provider)}?</h1>
      <p style="margin:0 0 16px;line-height:1.5">Hoi ${escapeHtml(i.customerName)},</p>
      <p style="margin:0 0 16px;line-height:1.5">Een week geleden heb je de onderhandel-email naar <strong>${escapeHtml(i.provider)}</strong> gestuurd. Wat was de uitkomst?</p>
      ${savingsLine}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
        <tr>
          <td style="padding-right:8px"><a href="${linkBase}?o=SUCCESS_SAVED" style="display:inline-block;background:${BRAND_GREEN};color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">✓ Ja gelukt</a></td>
          <td style="padding-right:8px"><a href="${linkBase}?o=FAILED_NO_DEAL" style="display:inline-block;background:${SLATE_600};color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">✗ Niet gelukt</a></td>
          <td><a href="${linkBase}?o=STILL_WAITING" style="display:inline-block;background:${SLATE_100};color:${SLATE_900};text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">⏳ Nog wachten</a></td>
        </tr>
      </table>
      <p style="margin:16px 0;font-size:13px;color:${SLATE_600};line-height:1.5">Niet gereageerd? Geen probleem — je hoort over 7 dagen opnieuw van ons.</p>
    `,
  });
}

export function followUpBrandedSubject(provider: string): string {
  return `Wat was de uitkomst met ${provider}?`;
}
