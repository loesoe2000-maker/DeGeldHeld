import { describe, it, expect } from "vitest";
import { PROVIDERS } from "../lib/providers";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+\d{1,3}[\s\d-]{8,14}$/;
const URL_RE = /^https?:\/\/[^\s]+$/;

/**
 * v7 sprint regel: nooit verzonnen retention-contacts. Daarom is de regel
 * dat élk gezet retention-veld een geldige shape moet hebben — en email
 * moet syntactisch valide zijn én een domain hebben dat ook in de
 * provider-naam of een bekende variant terugkomt (heuristiek tegen
 * verzinsels zoals retention@willekeurige-provider.nl).
 */
describe("providers-integrity: retention shape + plausibility", () => {
  for (const p of PROVIDERS) {
    if (!p.retention) continue;
    const r = p.retention;

    if (r.email !== undefined) {
      it(`${p.id}: retention.email is a valid email`, () => {
        expect(r.email).toMatch(EMAIL_RE);
      });
      it(`${p.id}: retention.email domain plausibly matches provider`, () => {
        const domain = (r.email!.split("@")[1] ?? "").toLowerCase();
        const slug = p.id.replace(/-/g, "");
        const canonicalFlat = p.canonical.toLowerCase().replace(/[^a-z0-9]/g, "");
        const dFlat = domain.replace(/[^a-z0-9]/g, "");
        const plausible =
          dFlat.includes(canonicalFlat) ||
          dFlat.includes(slug) ||
          // Allow well-known group domains (e.g. nn-group, ing-bank, etc.)
          p.names.some((n) => dFlat.includes(n.toLowerCase().replace(/[^a-z0-9]/g, "")));
        expect(plausible, `email ${r.email} should plausibly belong to ${p.canonical}`).toBe(true);
      });
    }

    if (r.url !== undefined) {
      it(`${p.id}: retention.url is a valid URL`, () => {
        expect(r.url).toMatch(URL_RE);
      });
    }

    if (r.phone !== undefined) {
      it(`${p.id}: retention.phone matches +CC NNNN format`, () => {
        expect(r.phone).toMatch(PHONE_RE);
      });
    }

    if (r.whatsapp !== undefined) {
      it(`${p.id}: retention.whatsapp matches phone format`, () => {
        expect(r.whatsapp).toMatch(PHONE_RE);
      });
    }
  }

  it("no provider has both email and obviously-fake retention", () => {
    const fakey = PROVIDERS.filter((p) => {
      if (!p.retention?.email) return false;
      const local = p.retention.email.split("@")[0];
      return local === "info" || local === "noreply" || local === "no-reply";
    });
    expect(fakey, `noreply/info addresses are not retention addresses: ${fakey.map((p) => p.id).join(",")}`).toEqual([]);
  });
});
