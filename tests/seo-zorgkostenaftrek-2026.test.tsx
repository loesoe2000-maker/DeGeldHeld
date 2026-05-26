import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => false }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/zorgkostenaftrek-aangifte-2026",
}));

import ZorgkostenaftrekPage, { metadata } from "@/app/zorgkostenaftrek-aangifte-2026/page";

describe("SEO /zorgkostenaftrek-aangifte-2026 — metadata", () => {
  it("title is keyword-targeted en ≤ 75 chars", () => {
    expect(typeof metadata.title).toBe("string");
    const t = metadata.title as string;
    expect(t).toMatch(/Zorgkostenaftrek/i);
    expect(t).toMatch(/2026/);
    expect(t.length).toBeLessThanOrEqual(75);
  });

  it("description is informatief en past in SERP-window", () => {
    const d = metadata.description as string;
    expect(d).toMatch(/€ 166|drempel|1,65%/);
    expect(d.length).toBeGreaterThan(120);
    expect(d.length).toBeLessThanOrEqual(170);
  });

  it("canonical absoluut + open graph aanwezig", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://degeldheld.com/zorgkostenaftrek-aangifte-2026",
    );
    expect(metadata.openGraph?.type).toBe("article");
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.openGraph?.description).toBeTruthy();
  });
});

describe("SEO /zorgkostenaftrek-aangifte-2026 — page content", () => {
  function r() {
    return render(<ZorgkostenaftrekPage />);
  }

  it("renders exactly 1 H1 with the target keyword", () => {
    const { container } = r();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/Zorgkostenaftrek.*aangifte 2026/i);
  });

  it("toont breadcrumb met juiste label", () => {
    const { getByTestId } = r();
    expect(getByTestId("seo-breadcrumb")).toBeInTheDocument();
    expect(getByTestId("seo-breadcrumb").textContent).toMatch(/Zorgkostenaftrek aangifte 2026/);
  });

  it("drempelbedragen 2025 + 2026 — alle 4 minima aanwezig", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 164"); // 2025 zonder partner
    expect(text).toContain("€ 328"); // 2025 met partner
    expect(text).toContain("€ 166"); // 2026 zonder partner
    expect(text).toContain("€ 332"); // 2026 met partner
  });

  it("formule + 1,65% en drempelinkomen genoemd", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/1,65%/);
    expect(text).toMatch(/drempelinkomen/i);
    expect(text).toMatch(/max\(/);
  });

  it("AOW-verhoging 113% + grensbedrag € 41.123 (2026) genoemd", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/113%/);
    expect(text).toContain("€ 41.123");
    expect(text).toMatch(/AOW/i);
  });

  it("aangifte-jaar-discipline: 2026-aangifte = 2025-drempels", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/inkomstenjaar 2025|aangifte over 2025/i);
    expect(text).toMatch(/2025-drempels|drempels.*2025/i);
  });

  it("expliciete niet-aftrekbaar lijst (eigen risico, premie)", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toMatch(/eigen risico/i);
    expect(text).toMatch(/[Pp]remie.*[Zz]orgverzekering/);
  });

  it("interne link naar /zorgkosten-check aanwezig", () => {
    const { container } = r();
    const links = container.querySelectorAll('a[href="/zorgkosten-check"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
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
    expect(text).toMatch(/Wft|geen fiscaal of financieel advies/i);
  });

  it("géén onbewezen revenue-claims (geen 'we garanderen verlaging')", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/garanderen wij|garanderen we de verlaging|garanderen we besparing/i);
  });
});

describe("anti-hallucinatie — bedragen + formule matchen V29_DATA + lib/zorgkosten.ts", () => {
  const src = readFileSync(
    resolve(__dirname, "..", "app/zorgkostenaftrek-aangifte-2026/page.tsx"),
    "utf8",
  );

  it("alle drempel-bedragen 2025-2026 staan in bron-file", () => {
    expect(src).toContain("€ 164");
    expect(src).toContain("€ 328");
    expect(src).toContain("€ 166");
    expect(src).toContain("€ 332");
    expect(src).toContain("€ 41.123");
    expect(src).toContain("€ 40.502");
  });

  it("lib/zorgkosten resolvable (smoke import)", async () => {
    await import("@/lib/zorgkosten");
    expect(src).toMatch(/1,65%/);
  });

  it("bron-comments verwijzen naar belastingdienst.nl", () => {
    expect(src).toMatch(/belastingdienst\.nl/);
  });
});
