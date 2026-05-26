import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => false }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/vlucht-vertraagd-vergoeding-eu261",
}));

import VluchtEu261Page, { metadata } from "@/app/vlucht-vertraagd-vergoeding-eu261/page";

describe("SEO /vlucht-vertraagd-vergoeding-eu261 — metadata", () => {
  it("title is keyword-targeted en ≤ 75 chars", () => {
    expect(typeof metadata.title).toBe("string");
    const t = metadata.title as string;
    expect(t).toMatch(/Vlucht vertraagd/i);
    expect(t).toMatch(/EU261/i);
    expect(t.length).toBeLessThanOrEqual(75);
  });

  it("description is informatief en past in SERP-window", () => {
    const d = metadata.description as string;
    expect(d).toMatch(/€ 250|€ 400|€ 600/);
    expect(d.length).toBeGreaterThan(120);
    expect(d.length).toBeLessThanOrEqual(170);
  });

  it("canonical absoluut + open graph aanwezig", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://degeldheld.com/vlucht-vertraagd-vergoeding-eu261",
    );
    expect(metadata.openGraph?.type).toBe("article");
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.openGraph?.description).toBeTruthy();
  });
});

describe("SEO /vlucht-vertraagd-vergoeding-eu261 — page content", () => {
  function r() {
    return render(<VluchtEu261Page />);
  }

  it("renders exactly 1 H1 with the target keyword", () => {
    const { container } = r();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/Vlucht vertraagd.*EU261/i);
  });

  it("toont breadcrumb met juiste label", () => {
    const { getByTestId } = r();
    expect(getByTestId("seo-breadcrumb")).toBeInTheDocument();
    expect(getByTestId("seo-breadcrumb").textContent).toMatch(/Vlucht vertraagd|EU261/i);
  });

  it("compensatiebanden — alle 3 bedragen + drempels in markup", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 250");
    expect(text).toContain("€ 400");
    expect(text).toContain("€ 600");
    expect(text).toContain("1.500 km");
    expect(text).toContain("3.500 km");
    expect(text).toMatch(/3 u|≥ 3 u|3 uur/);
    expect(text).toMatch(/4 u|≥ 4 u|4 uur/);
  });

  it("verordening 261/2004 + 2 jaar verjaring genoemd", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/261\/2004/);
    expect(text).toMatch(/2 jaar/);
    expect(text).toMatch(/verjaring|verjaart/i);
  });

  it("buitengewone omstandigheden + personeelsstaking-distinctie", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/buitengewone omstandigheden|extreem weer|ATC/i);
    expect(text).toMatch(/personeelsstaking|staking van eigen/i);
  });

  it("CLAIMS-flag off → géén /vluchtclaim-CTA-knop, wél fallback-uitleg", () => {
    const { container } = r();
    expect(container.querySelector('[data-testid="vluchtclaim-cta"]')).toBeNull();
    const text = container.textContent ?? "";
    expect(text).toMatch(/no-cure-no-pay|specialist|maatschappij/i);
  });

  it("verschil met NS expliciet (EU-PRR/NS-vergoeding)", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/NS|EU-PRR/);
  });

  it("JSON-LD FAQPage met ≥ 3 Q&A's + BreadcrumbList", () => {
    const { container } = r();
    const scripts = Array.from(
      container.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    );
    expect(scripts.length).toBeGreaterThanOrEqual(2);
    const blobs = scripts.map((s) => JSON.parse(s.textContent ?? "{}"));
    const faq = blobs.find((b) => b["@type"] === "FAQPage");
    expect(faq).toBeTruthy();
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3);
    for (const q of faq.mainEntity) {
      expect(q["@type"]).toBe("Question");
      expect(q.acceptedAnswer["@type"]).toBe("Answer");
    }
    const breadcrumb = blobs.find((b) => b["@type"] === "BreadcrumbList");
    expect(breadcrumb).toBeTruthy();
  });

  it("disclaimer 'indicatie, geen advies' + Wft-uitsluiting", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/Indicatie, geen advies/i);
    expect(text).toMatch(/Wft|geen financieel of juridisch advies/i);
  });

  it("géén onbewezen revenue-claims (geen 'we garanderen verlaging')", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/garanderen wij|garanderen we de verlaging|garanderen we besparing/i);
  });
});

describe("anti-hallucinatie — bedragen + drempels matchen lib/eu261.ts", () => {
  const src = readFileSync(
    resolve(__dirname, "..", "app/vlucht-vertraagd-vergoeding-eu261/page.tsx"),
    "utf8",
  );

  it("alle 3 EU261-bedragen + drempels staan in bron-file", async () => {
    const { EU261 } = await import("@/lib/eu261");
    expect(EU261.payShortCents).toBe(25_000);
    expect(EU261.payMediumCents).toBe(40_000);
    expect(EU261.payLongCents).toBe(60_000);
    expect(EU261.shortHaulKm).toBe(1500);
    expect(EU261.longHaulKm).toBe(3500);

    expect(src).toContain("€ 250");
    expect(src).toContain("€ 400");
    expect(src).toContain("€ 600");
    expect(src).toContain("1.500 km");
    expect(src).toContain("3.500 km");
  });

  it("bron-comments verwijzen naar europa.eu + euclaim", () => {
    expect(src).toMatch(/europa\.eu/);
    expect(src).toMatch(/euclaim\.nl/);
  });
});
