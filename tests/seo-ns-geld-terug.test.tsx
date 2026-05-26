import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => false }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ns-geld-terug-vertraging",
}));

import NsVertragingPage, { metadata } from "@/app/ns-geld-terug-vertraging/page";

describe("SEO /ns-geld-terug-vertraging — metadata", () => {
  it("title is keyword-targeted en ≤ 75 chars", () => {
    expect(typeof metadata.title).toBe("string");
    const t = metadata.title as string;
    expect(t).toMatch(/NS/i);
    expect(t).toMatch(/vertraging/i);
    expect(t.length).toBeLessThanOrEqual(75);
  });

  it("description is informatief en past in SERP-window", () => {
    const d = metadata.description as string;
    expect(d).toMatch(/50%|100%|EU-PRR|deadline/i);
    expect(d.length).toBeGreaterThan(120);
    expect(d.length).toBeLessThanOrEqual(170);
  });

  it("canonical absoluut + open graph aanwezig", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://degeldheld.com/ns-geld-terug-vertraging",
    );
    expect(metadata.openGraph?.type).toBe("article");
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.openGraph?.description).toBeTruthy();
  });
});

describe("SEO /ns-geld-terug-vertraging — page content", () => {
  function r() {
    return render(<NsVertragingPage />);
  }

  it("renders exactly 1 H1 with the target keyword", () => {
    const { container } = r();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/NS geld terug bij vertraging/i);
  });

  it("toont breadcrumb met juiste label", () => {
    const { getByTestId } = r();
    expect(getByTestId("seo-breadcrumb")).toBeInTheDocument();
    expect(getByTestId("seo-breadcrumb").textContent).toMatch(/NS geld terug bij vertraging/);
  });

  it("binnenlandse drempels + percentages", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/30-59 minuten/);
    expect(text).toMatch(/≥ 60 minuten|60 minuten of meer/);
    expect(text).toMatch(/50%/);
    expect(text).toMatch(/100%/);
  });

  it("EU-PRR internationale drempels + percentages", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/EU-PRR|2021\/782/);
    expect(text).toMatch(/60-119/);
    expect(text).toMatch(/≥ 120|120 minuten/);
    expect(text).toMatch(/25%/);
  });

  it("minimum claim € 2,30 + deadline 1 maand expliciet", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 2,30");
    expect(text).toMatch(/1 maand|binnen 1 maand/i);
  });

  it("overmacht-uitzondering + staking-distinctie", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/stroomuitval|overmacht/i);
    expect(text).toMatch(/staking/i);
    expect(text).toMatch(/Wél compensatie|niet als overmacht/i);
  });

  it("interne link naar /ns-check aanwezig", () => {
    const { container } = r();
    const links = container.querySelectorAll('a[href="/ns-check"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("abonnementen-sectie + 'eigen vaste compensatie-bedragen' eerlijkheid", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/abonnement/i);
    expect(text).toMatch(/Mijn NS/i);
    expect(text).toMatch(/vaste compensatie-bedragen|vaste bedragen|verschillen per abonnement/i);
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

describe("anti-hallucinatie — getallen matchen V29_DATA", () => {
  const src = readFileSync(
    resolve(__dirname, "..", "app/ns-geld-terug-vertraging/page.tsx"),
    "utf8",
  );

  it("alle NS-percentages + min-claim staan in bron-file", () => {
    expect(src).toContain("50%");
    expect(src).toContain("100%");
    expect(src).toContain("25%");
    expect(src).toContain("€ 2,30");
    expect(src).toContain("30-59");
    expect(src).toContain("60-119");
  });

  it("bron-comments verwijzen naar ns.nl + EU-PRR", () => {
    expect(src).toMatch(/ns\.nl|nsgo\.nl/);
    expect(src).toMatch(/eur-lex\.europa\.eu/);
  });
});
