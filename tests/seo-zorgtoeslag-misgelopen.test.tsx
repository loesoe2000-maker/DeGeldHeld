import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => false }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/zorgtoeslag-2026-misgelopen",
}));

import ZorgtoeslagPage, { metadata } from "@/app/zorgtoeslag-2026-misgelopen/page";

describe("SEO /zorgtoeslag-2026-misgelopen — metadata", () => {
  it("title is keyword-targeted en ≤ 75 chars", () => {
    expect(typeof metadata.title).toBe("string");
    const t = metadata.title as string;
    expect(t).toMatch(/Zorgtoeslag/i);
    expect(t).toMatch(/2026/);
    expect(t.length).toBeLessThanOrEqual(75);
  });

  it("description is informatief en past in SERP-window", () => {
    const d = metadata.description as string;
    expect(d).toMatch(/€ 129|€ 246|inkomensgrens|vermogensgrens/i);
    expect(d.length).toBeGreaterThan(120);
    expect(d.length).toBeLessThanOrEqual(170);
  });

  it("canonical absoluut + open graph aanwezig", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://degeldheld.com/zorgtoeslag-2026-misgelopen",
    );
    expect(metadata.openGraph?.type).toBe("article");
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.openGraph?.description).toBeTruthy();
  });
});

describe("SEO /zorgtoeslag-2026-misgelopen — page content", () => {
  function r() {
    return render(<ZorgtoeslagPage />);
  }

  it("renders exactly 1 H1 with the target keyword", () => {
    const { container } = r();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/Zorgtoeslag 2026 misgelopen/i);
  });

  it("toont breadcrumb met juiste label", () => {
    const { getByTestId } = r();
    expect(getByTestId("seo-breadcrumb")).toBeInTheDocument();
    expect(getByTestId("seo-breadcrumb").textContent).toMatch(/Zorgtoeslag 2026 misgelopen/);
  });

  it("inkomensgrens 2026 — alleenstaand + partners", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 40.857"); // alleenstaand
    expect(text).toContain("€ 51.142"); // partners
  });

  it("vermogensgrens 2026 — alleenstaand + partners", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 146.011"); // alleenstaand
    expect(text).toContain("€ 184.633"); // partners
  });

  it("max-toeslag 2026 — beide bedragen", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 129"); // alleenstaand /mnd
    expect(text).toContain("€ 246"); // partners /mnd
  });

  it("CPB/SCP non-take-up framing aanwezig", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/CPB|SCP/);
    expect(text).toMatch(/10%/);
  });

  it("afbouw-eerlijkheid: max is bovengrens, niet vast bedrag", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/bovengrens|bouwt.*af/i);
  });

  it("interne link naar /geld-check aanwezig", () => {
    const { container } = r();
    const links = container.querySelectorAll('a[href="/geld-check"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("aanvraag-flow noemt Mijn Toeslagen + DigiD", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/Mijn Toeslagen/i);
    expect(text).toMatch(/DigiD/);
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

describe("anti-hallucinatie — bedragen matchen BENEFITS_DATA_2026", () => {
  const src = readFileSync(
    resolve(__dirname, "..", "app/zorgtoeslag-2026-misgelopen/page.tsx"),
    "utf8",
  );

  it("alle 6 zorgtoeslag-bedragen 2026 staan in bron-file", () => {
    expect(src).toContain("€ 40.857");
    expect(src).toContain("€ 51.142");
    expect(src).toContain("€ 146.011");
    expect(src).toContain("€ 184.633");
    expect(src).toContain("€ 129");
    expect(src).toContain("€ 246");
  });

  it("bron-comments verwijzen naar belastingdienst.nl", () => {
    expect(src).toMatch(/belastingdienst\.nl/);
  });
});
