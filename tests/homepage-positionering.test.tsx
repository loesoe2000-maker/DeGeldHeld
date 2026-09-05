import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import path from "path";
import Hero from "../components/Hero";

/**
 * v40 F1 — B-verbouwing: claims zijn het hart van de homepage, onderhandelen
 * is bijproduct. Deze suite borgt de omkering én de eerlijkheidsregels
 * (concrete fee, "jij dient in", flag-gated fallback blijft intact).
 */

const flagOn = vi.hoisted(() => ({
  GELD_CHECK_ENABLED: true,
  MONEYFINDER_HUB_ENABLED: true,
  CLAIMS: false,
}));
vi.mock("@/lib/feature-flags", () => ({
  isEnabled: (f: string) => Boolean((flagOn as Record<string, boolean>)[f]),
}));

beforeEach(() => {
  flagOn.GELD_CHECK_ENABLED = true;
  flagOn.MONEYFINDER_HUB_ENABLED = true;
  flagOn.CLAIMS = false;
});

describe("Hero — claims-first met hub aan", () => {
  it("primaire CTA gaat naar de checks-hub, niet naar onderhandelen", () => {
    render(<Hero />);
    expect(
      screen.getByRole("link", { name: /Start een gratis check/i }),
    ).toHaveAttribute("href", "/vind-al-je-geld");
  });

  it("onderhandelen is gedegradeerd tot bijproduct-link (maar blijft bereikbaar)", () => {
    render(<Hero />);
    expect(
      screen.getByRole("link", { name: /wij onderhandelen mee/i }),
    ).toHaveAttribute("href", "/onderhandel");
  });

  it("live track record is prominent gelinkt", () => {
    render(<Hero />);
    expect(screen.getByTestId("hero-link-proof")).toHaveAttribute("href", "/proof");
  });

  it("v41 GRATIS: geen enkel fee-percentage in de hero, wel 'jij dient in'", () => {
    const { container } = render(<Hero />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/20%/);
    expect(text).not.toMatch(/25%/);
    expect(text).not.toMatch(/no.?cure/i);
    expect(text).toMatch(/gratis/i);
    expect(text).toMatch(/zonder DigiD/i);
    // Wij bereiden voor, de klant dient in — nooit "wij dienen in"-overclaim.
    expect(text).toMatch(/jij dient in/i);
    expect(text).not.toMatch(/wij dienen(?:\s+\w+){0,3}\s+in\b/i);
  });

  it("fallback zonder flags blijft de oude onderhandel-hero (geen dode links)", () => {
    flagOn.GELD_CHECK_ENABLED = false;
    flagOn.MONEYFINDER_HUB_ENABLED = false;
    render(<Hero />);
    expect(screen.getByText(/Houd je geld in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /hoe het werkt/i })).toHaveAttribute("href", "/demo");
  });
});

describe("metadata + banner — claims-first bronnen", () => {
  const layout = readFileSync(path.join(__dirname, "../app/layout.tsx"), "utf8");
  const page = readFileSync(path.join(__dirname, "../app/page.tsx"), "utf8");
  const banner = readFileSync(
    path.join(__dirname, "../components/MoneyfinderHubBanner.tsx"),
    "utf8",
  );

  it("site-title en descriptions zijn claims-first (title + og + twitter consistent)", () => {
    expect(layout).toMatch(/haal terug wat van jou is/i);
    expect(layout).not.toMatch(/automatisch onderhandelen op je maandlasten/);
    // v41: dezelfde GRATIS-description op alle drie de plekken.
    const desc = layout.match(/Gratis checks voor Box 3-belasting/g) ?? [];
    expect(desc.length).toBe(3);
    expect(layout).not.toMatch(/No cure, no pay: 20%/);
  });

  it("organisation-LD op de homepage beschrijft geld terughalen, niet alleen onderhandelen", () => {
    expect(page).toMatch(/Haalt geld terug/);
  });

  it("hub-banner is niet langer een 'Of:'-bijzaak en blijft flag-gated", () => {
    expect(banner).not.toMatch(/Of: vind je geld/);
    expect(banner).toMatch(/Dit is waar we je geld terughalen/);
    expect(banner).toMatch(/isEnabled\("MONEYFINDER_HUB_ENABLED"\)/);
  });
});
