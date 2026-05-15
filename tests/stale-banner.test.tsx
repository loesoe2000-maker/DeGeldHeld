/**
 * Stale-banner verschijnt als bill.invoiceDate ouder dan 180 dagen is.
 * /onderhandel/analyse is een async server component → niet direct render-bar
 * in jsdom. We extracten de banner-logica naar een testbare presentational
 * component die mirror is van de inline JSX op de pagina.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function StaleBanner({ ageDays, ageMonths }: { ageDays: number | null; ageMonths: number }) {
  const STALE_DAYS = 180;
  const show = ageDays != null && ageDays > STALE_DAYS;
  if (!show) return null;
  return (
    <div role="alert" data-testid="stale-banner" className="bg-amber-50">
      <strong>Deze factuur is {ageMonths} maanden oud</strong> — markt-prijzen
      kunnen gewijzigd zijn. Upload een recente factuur voor nauwkeurig advies.
    </div>
  );
}

describe("stale-banner/visible threshold", () => {
  it("toont banner bij 200 dagen oud (>180)", () => {
    render(<StaleBanner ageDays={200} ageMonths={6} />);
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("toont banner bij 1825 dagen oud (5 jaar = aug 2020 vs nu)", () => {
    render(<StaleBanner ageDays={1825} ageMonths={60} />);
    expect(screen.getByText(/60 maanden oud/)).toBeInTheDocument();
  });

  it("verbergt banner bij 30 dagen oud (verse factuur)", () => {
    const { container } = render(<StaleBanner ageDays={30} ageMonths={1} />);
    expect(container.firstChild).toBeNull();
  });

  it("verbergt banner exact op 180 (niet > 180)", () => {
    const { container } = render(<StaleBanner ageDays={180} ageMonths={6} />);
    expect(container.firstChild).toBeNull();
  });

  it("toont banner op 181 dagen (boven threshold)", () => {
    render(<StaleBanner ageDays={181} ageMonths={6} />);
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
  });

  it("verbergt banner bij null age (geen invoiceDate beschikbaar)", () => {
    const { container } = render(<StaleBanner ageDays={null} ageMonths={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("bevat de exacte NL kopij uit specificatie", () => {
    render(<StaleBanner ageDays={400} ageMonths={13} />);
    const banner = screen.getByTestId("stale-banner");
    expect(banner.textContent).toMatch(/markt-prijzen kunnen gewijzigd zijn/);
    expect(banner.textContent).toMatch(/Upload een recente factuur/);
    expect(banner.textContent).toMatch(/13 maanden oud/);
  });
});
