import { describe, it, expect } from "vitest";
import { PROVIDERS } from "../lib/providers";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const URL_RE = /^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i;
const PHONE_RE = /^\+\d{1,3}[\s\d-]{8,14}$/;

function flatten(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").toLowerCase();
}

describe("providers-shape: every set retention field has valid syntax", () => {
  it("retention.email is syntactically valid email", () => {
    const bad: string[] = [];
    for (const p of PROVIDERS) {
      if (p.retention?.email && !EMAIL_RE.test(p.retention.email)) {
        bad.push(`${p.id}: ${p.retention.email}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("retention.email domain plausibly matches provider", () => {
    const suspect: string[] = [];
    for (const p of PROVIDERS) {
      if (!p.retention?.email) continue;
      const d = flatten(emailDomain(p.retention.email));
      const canonical = flatten(p.canonical);
      const slugFlat = flatten(p.id);
      const matchesCanonical = d.includes(canonical);
      const matchesSlug = d.includes(slugFlat);
      const matchesAlias = p.names.some((n) => d.includes(flatten(n)));
      if (!matchesCanonical && !matchesSlug && !matchesAlias) {
        suspect.push(`${p.id}: ${p.retention.email}`);
      }
    }
    expect(suspect, `Provider retention emails with no domain match: ${suspect.join(", ")}`).toEqual([]);
  });

  it("retention.email never uses noreply/info aliases (those don't accept retention contact)", () => {
    const wrong: string[] = [];
    for (const p of PROVIDERS) {
      if (!p.retention?.email) continue;
      const local = p.retention.email.split("@")[0].toLowerCase();
      if (["info", "noreply", "no-reply", "donotreply", "automated"].includes(local)) {
        wrong.push(`${p.id}: ${p.retention.email}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("retention.url is HTTPS only and well-formed", () => {
    const bad: string[] = [];
    for (const p of PROVIDERS) {
      if (p.retention?.url && !URL_RE.test(p.retention.url)) {
        bad.push(`${p.id}: ${p.retention.url}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("retention.phone is international format (+CC ...)", () => {
    const bad: string[] = [];
    for (const p of PROVIDERS) {
      if (p.retention?.phone && !PHONE_RE.test(p.retention.phone)) {
        bad.push(`${p.id}: ${p.retention.phone}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("retention.whatsapp is international format", () => {
    const bad: string[] = [];
    for (const p of PROVIDERS) {
      if (p.retention?.whatsapp && !PHONE_RE.test(p.retention.whatsapp)) {
        bad.push(`${p.id}: ${p.retention.whatsapp}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("provider count is >100 (broad market coverage)", () => {
    expect(PROVIDERS.length).toBeGreaterThan(100);
  });

  it("every provider has a non-empty canonical name + at least one alias", () => {
    const broken = PROVIDERS.filter((p) => !p.canonical || p.names.length === 0);
    expect(broken).toEqual([]);
  });

  it("every provider id is unique kebab-case", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const p of PROVIDERS) {
      if (seen.has(p.id)) dupes.push(p.id);
      seen.add(p.id);
      expect(p.id, `${p.id} not kebab`).toMatch(/^[a-z0-9-]+$/);
    }
    expect(dupes).toEqual([]);
  });
});
