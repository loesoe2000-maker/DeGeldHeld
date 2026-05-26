import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => false }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/huurtoeslag-2026-berekenen",
}));

import HuurtoeslagPage, { metadata } from "@/app/huurtoeslag-2026-berekenen/page";

describe("SEO /huurtoeslag-2026-berekenen — metadata", () => {
  it("title is keyword-targeted en ≤ 75 chars", () => {
    expect(typeof metadata.title).toBe("string");
    const t = metadata.title as string;
    expect(t).toMatch(/Huurtoeslag/i);
    expect(t).toMatch(/2026/);
    expect(t).toMatch(/berekenen/i);
    expect(t.length).toBeLessThanOrEqual(75);
  });

  it("description is informatief en past in SERP-window", () => {
    const d = metadata.description as string;
    expect(d).toMatch(/vermogensgrens|kwaliteitskorting|aftopping/i);
    expect(d.length).toBeGreaterThan(120);
    expect(d.length).toBeLessThanOrEqual(170);
  });

  it("canonical absoluut + open graph aanwezig", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://degeldheld.com/huurtoeslag-2026-berekenen",
    );
    expect(metadata.openGraph?.type).toBe("article");
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.openGraph?.description).toBeTruthy();
  });
});

describe("SEO /huurtoeslag-2026-berekenen — page content", () => {
  function r() {
    return render(<HuurtoeslagPage />);
  }

  it("renders exactly 1 H1 with the target keyword", () => {
    const { container } = r();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/Huurtoeslag 2026 berekenen/i);
  });

  it("toont breadcrumb met juiste label", () => {
    const { getByTestId } = r();
    expect(getByTestId("seo-breadcrumb")).toBeInTheDocument();
    expect(getByTestId("seo-breadcrumb").textContent).toMatch(/Huurtoeslag 2026 berekenen/);
  });

  it("huurgrenzen 2026 — alle 4 bedragen aanwezig", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 498,20"); // kwaliteitskortingsgrens
    expect(text).toContain("€ 713,02"); // lage aftopping
    expect(text).toContain("€ 764,14"); // hoge aftopping
    expect(text).toContain("€ 932,93"); // max rekenhuur
  });

  it("vermogensgrens 2026 — alleenstaand + partners", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 38.479"); // per persoon
    expect(text).toContain("€ 76.958"); // partners samen
  });

  it("V31-discipline: max-huurgrens is GEEN drempel meer in 2026", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/géén voorwaarde|geen voorwaarde|geen drempel/i);
    expect(text).toMatch(/aftop|afgetopt/i);
  });

  it("geen vaste inkomensgrens — expliciet genoemd", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/geen vaste inkomensgrens|geen inkomensgrens/i);
  });

  it("interne link naar /geld-check aanwezig", () => {
    const { container } = r();
    const links = container.querySelectorAll('a[href="/geld-check"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("aanvraag-flow noemt MijnBelastingdienst + DigiD", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/MijnBelastingdienst/i);
    expect(text).toMatch(/DigiD/);
    expect(text).toMatch(/proefberekening/i);
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

  it("disclaimer 'indicatie, geen advies' onderaan + Wft-uitsluiting", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/Indicatie, geen advies/i);
    expect(text).toMatch(/Wft|geen financieel of fiscaal advies/i);
  });

  it("géén onbewezen revenue-claims (geen 'we garanderen verlaging')", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/garanderen wij|garanderen we de verlaging|garanderen we besparing/i);
  });
});

describe("anti-hallucinatie — bedragen matchen V29_DATA/BENEFITS_DATA-conventie", () => {
  const src = readFileSync(
    resolve(__dirname, "..", "app/huurtoeslag-2026-berekenen/page.tsx"),
    "utf8",
  );

  it("alle 4 huurgrenzen 2026 staan in bron-file", () => {
    expect(src).toContain("€ 498,20");
    expect(src).toContain("€ 713,02");
    expect(src).toContain("€ 764,14");
    expect(src).toContain("€ 932,93");
  });

  it("vermogensgrens 2026 alleenstaand € 38.479 + partner € 76.958 in bron-file", () => {
    expect(src).toContain("€ 38.479");
    expect(src).toContain("€ 76.958");
  });

  it("bron-comments verwijzen naar officiële URLs (Rijksoverheid + Belastingdienst)", () => {
    expect(src).toMatch(/rijksoverheid\.nl/);
    expect(src).toMatch(/belastingdienst\.nl/);
  });
});
