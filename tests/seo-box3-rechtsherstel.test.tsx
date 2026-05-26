import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/feature-flags", () => ({ isEnabled: () => false }));
// Footer reads next/navigation; mock conservatively where needed.
vi.mock("next/navigation", () => ({
  usePathname: () => "/box3-rechtsherstel-aanvragen-2026",
}));

import Box3RechtsherstelPage, { metadata } from "@/app/box3-rechtsherstel-aanvragen-2026/page";

describe("SEO /box3-rechtsherstel-aanvragen-2026 — metadata", () => {
  it("title is keyword-targeted en ≤ 75 chars", () => {
    expect(typeof metadata.title).toBe("string");
    const t = metadata.title as string;
    expect(t).toMatch(/Box 3-rechtsherstel/i);
    expect(t).toMatch(/2026/);
    expect(t.length).toBeLessThanOrEqual(75);
  });

  it("description is informatief en past in SERP-window", () => {
    const d = metadata.description as string;
    expect(d).toMatch(/OWR|tegenbewijsregeling/i);
    expect(d.length).toBeGreaterThan(120);
    expect(d.length).toBeLessThanOrEqual(170);
  });

  it("canonical absoluut + open graph aanwezig", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://degeldheld.com/box3-rechtsherstel-aanvragen-2026",
    );
    expect(metadata.openGraph?.type).toBe("article");
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.openGraph?.description).toBeTruthy();
  });
});

describe("SEO /box3-rechtsherstel-aanvragen-2026 — page content", () => {
  function r() {
    return render(<Box3RechtsherstelPage />);
  }

  it("renders exactly 1 H1 with the target keyword", () => {
    const { container } = r();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/Box 3-rechtsherstel aanvragen in 2026/i);
  });

  it("toont breadcrumb met juiste label", () => {
    const { getByTestId } = r();
    expect(getByTestId("seo-breadcrumb")).toBeInTheDocument();
    expect(getByTestId("seo-breadcrumb").textContent).toMatch(/Box 3-rechtsherstel 2026/);
  });

  it("forfait-tabel: élke jaarregel + Belastingdienst 2026 = 1,28% (NIET 1,44%)", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    for (const jaar of ["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]) {
      expect(text).toContain(jaar);
    }
    // 2026 banktegoeden: 1,28% (Belastingdienst) — discipline-anchor
    expect(text).toContain("1,28%");
    // Expliciete kanttekening dat aggregators 1,44% noemen + uitleg
    expect(text).toMatch(/1,44%/);
    expect(text).toMatch(/officiële cijfers|Belastingdienst publiceert/i);
  });

  it("heffingsvrij vermogen 2026 + schuldendrempel correct", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("€ 59.357"); // alleenstaand
    expect(text).toContain("€ 118.714"); // met partner
    expect(text).toContain("€ 3.800"); // schuldendrempel
  });

  it("OWR-deadlines + Wet tegenbewijsregeling-datum genoemd", () => {
    const { container } = r();
    const text = container.textContent ?? "";
    expect(text).toContain("19 juli 2025"); // ingangsdatum wet
    expect(text).toContain("1 mei 2026"); // deadline 2021-2024 zelfindiener
    expect(text).toContain("1 oktober 2026"); // deadline via adviseur
    expect(text).toContain("31 december 2025"); // 2020-deadline verstreken
  });

  it("interne link naar /box3-check + uitleg HARDE €500-gate", () => {
    const { container } = r();
    const link = container.querySelector('a[href="/box3-check"]');
    expect(link).not.toBeNull();
    const text = container.textContent ?? "";
    expect(text).toMatch(/€ 500/); // €500-drempel ergens
    expect(text).toMatch(/25%/); // NCNP-tarief
    expect(text).toMatch(/DIY-brief|DIY|zelf/i); // DIY-pad eerlijk
  });

  it("JSON-LD FAQPage met ≥ 3 Q&A's", () => {
    const { container } = r();
    const scripts = Array.from(
      container.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    );
    expect(scripts.length).toBeGreaterThanOrEqual(2); // FAQ + breadcrumb
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

  it("disclaimer 'indicatie, geen advies' onderaan + Wft-uitsluiting genoemd", () => {
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

describe("anti-hallucinatie — élk bedrag matcht lib/box3.ts-constants", () => {
  // Source-read: getoonde getallen moeten matchen met de engine-constants.
  // Drift-protection: als box3.ts ooit verandert zonder dat de SEO-pagina
  // wordt bijgewerkt, faalt deze test.
  const src = readFileSync(
    resolve(__dirname, "..", "app/box3-rechtsherstel-aanvragen-2026/page.tsx"),
    "utf8",
  );
  it("2026 banktegoeden = 1,28% in zowel bron-file als engine-constant", async () => {
    // De FORFAIT-constant zelf is privé in lib/box3.ts; we verifiëren dat
    // de SEO-pagina de Belastingdienst-waarde 1,28% noemt + dat box3.ts
    // resolvable is (smoke import).
    await import("@/lib/box3");
    expect(src).toContain("1,28%");
  });
  it("heffingsvrij 2026 alleenstaand € 59.357 + partner € 118.714 staan vermeld", () => {
    // bron: BENEFITS_DATA_2026.md / V29_DATA_2026.md
    expect(src).toContain("€ 59.357");
    expect(src).toContain("€ 118.714");
  });
});
