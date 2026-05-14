import { escapeHtml } from "@/lib/email";

export type FollowUpInput = {
  customerName: string;
  provider: string;
  expectedSavingsCents: number;
  negotiationId: string;
  appUrl: string;
};

export function followUpHtml(i: FollowUpInput): string {
  const linkBase = `${i.appUrl}/onderhandel/${i.negotiationId}/outcome`;
  return `<!doctype html>
<html lang="nl"><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
<h1 style="color:#047857">Hoe ging het met ${escapeHtml(i.provider)}?</h1>
<p>Hoi ${escapeHtml(i.customerName)},</p>
<p>Een week geleden heb je de onderhandel-email naar <strong>${escapeHtml(i.provider)}</strong> verstuurd.
Wat was de uitkomst?</p>

<p style="margin:24px 0">
  <a href="${linkBase}?o=SUCCESS_SAVED" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-right:8px">✓ Bespaard!</a>
  <a href="${linkBase}?o=FAILED_NO_DEAL" style="background:#64748b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-right:8px">✗ Geen deal</a>
  <a href="${linkBase}?o=STILL_WAITING" style="background:#e2e8f0;color:#1e293b;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">⏳ Nog wachten</a>
</p>

<p style="font-size:13px;color:#64748b">Niet gereageerd? Geen probleem — je hoort over 7 dagen opnieuw van ons.</p>
</body></html>`;
}

export function followUpSubject(provider: string): string {
  return `Wat was de uitkomst met ${provider}?`;
}
