/**
 * scripts/verify-providers.ts
 *
 * Verifieer retention-data per provider:
 *   - retention.email: DNS MX-lookup → INVALID als MX ontbreekt
 *   - retention.url: HEAD → INVALID bij 404/5xx
 *   - retention.phone/whatsapp: regex-check (+CC ddd ddd ddd)
 *
 * Output: 3 lijsten (VALIDATED / NEEDS_FILL / INVALID_OR_UNKNOWN).
 *
 * Run:
 *   npx tsx scripts/verify-providers.ts
 */

export {};

import { PROVIDERS } from "../lib/providers";
import { resolveMx } from "node:dns/promises";

type Status = "VALIDATED" | "NEEDS_FILL" | "INVALID_OR_UNKNOWN";

const HEAD_TIMEOUT_MS = 8_000;

function emailDomain(email: string): string | null {
  const m = /@([a-z0-9.-]+)$/i.exec(email.trim());
  return m ? m[1].toLowerCase() : null;
}

async function checkMx(email: string): Promise<boolean> {
  const domain = emailDomain(email);
  if (!domain) return false;
  try {
    const mx = await resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}

async function checkUrl(url: string): Promise<{ ok: boolean; status: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    // try HEAD first; if 405/403 fall back to GET with light range
    let r = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
    if (r.status === 405 || r.status === 403) {
      r = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "follow", headers: { range: "bytes=0-256" } });
    }
    return { ok: r.status < 400, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

function looksLikePhone(s: string): boolean {
  // +CC plus 8-12 digits incl. spaces or dashes
  return /^\+\d{1,3}[\s\d-]{8,14}$/.test(s.trim());
}

async function main() {
  const validated: string[] = [];
  const needsFill: string[] = [];
  const invalid: string[] = [];

  for (const p of PROVIDERS) {
    if (!p.retention) {
      needsFill.push(`${p.id} (${p.country}/${p.category})`);
      continue;
    }
    const r = p.retention;
    const issues: string[] = [];

    if (r.email) {
      const ok = await checkMx(r.email);
      if (!ok) issues.push(`email MX missing: ${r.email}`);
    }
    if (r.url) {
      const { ok, status } = await checkUrl(r.url);
      if (!ok) issues.push(`url ${status} ${r.url}`);
    }
    if (r.phone && !looksLikePhone(r.phone)) issues.push(`phone format ${r.phone}`);
    if (r.whatsapp && !looksLikePhone(r.whatsapp)) issues.push(`whatsapp format ${r.whatsapp}`);

    if (issues.length > 0) {
      invalid.push(`${p.id}: ${issues.join("; ")}`);
    } else {
      validated.push(p.id);
    }
  }

  console.log(`\n=== VALIDATED (${validated.length}) ===`);
  for (const v of validated) console.log(`  ✓ ${v}`);

  console.log(`\n=== NEEDS_FILL (${needsFill.length}) ===`);
  for (const n of needsFill) console.log(`  · ${n}`);

  console.log(`\n=== INVALID_OR_UNKNOWN (${invalid.length}) ===`);
  for (const i of invalid) console.log(`  ✗ ${i}`);

  console.log(`\nTotal: ${PROVIDERS.length} providers`);
}

void main();
