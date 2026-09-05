import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Hero from "../components/Hero";

/**
 * v28 DEEL 2 — "vind al je geld"-framing op de landing + funnel naar de
 * rekeningen-onderhandeling vanaf de geld-check. Flag-gated: zonder vlag(en)
 * ziet de pagina er hetzelfde uit als vóór v28.
 */
const flagOn = vi.hoisted(() => ({ GELD_CHECK_ENABLED: true, CLAIMS: false }));
vi.mock("@/lib/feature-flags", () => ({
  isEnabled: (f: string) => Boolean((flagOn as Record<string, boolean>)[f]),
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

beforeEach(() => {
  flagOn.GELD_CHECK_ENABLED = true;
  flagOn.CLAIMS = false;
});

describe("Hero — claims-first framing (v40 B-verbouwing)", () => {
  it("opent claims-first met check-flags aan; track record vervangt de demo-link", () => {
    render(<Hero />);
    expect(screen.getByText(/Haal terug wat/i)).toBeInTheDocument();
    // Hub-flag staat in deze suite uit → de primaire CTA blijft de upload-route.
    expect(
      screen.getByRole("link", { name: /Upload je rekening — gratis/i }),
    ).toHaveAttribute("href", "/onderhandel");
    expect(screen.getByRole("link", { name: /Inloggen/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /track record/i })).toHaveAttribute("href", "/proof");
  });

  it("v41: subtitel is claims-first én noemt gratis, geen fee meer", () => {
    render(<Hero />);
    expect(screen.getByText(/Box 3-belasting/i)).toBeInTheDocument();
    expect(screen.getByText(/toeslagen/i)).toBeInTheDocument();
    expect(screen.getByText(/kosteloos/i)).toBeInTheDocument();
  });

  it("falls back to the original copy when both flags are off", () => {
    flagOn.GELD_CHECK_ENABLED = false;
    flagOn.CLAIMS = false;
    render(<Hero />);
    // v32 fee-integriteit: fallback noemt geen telecom/internet meer
    // (TELECOM is sinds V30 fee:false — Plus-belscript i.p.v. 20%-NCNP).
    expect(screen.getByText(/Upload je energierekening of abonnementsfactuur/i)).toBeInTheDocument();
  });
});

// Cross-CTA at the bottom of the geld-check results.
describe("GeldCheckClient — cross-CTA naar /onderhandel", () => {
  it("renders the 'check ook mijn rekeningen' link after results", async () => {
    // Mock the feature-flag (geld-check is gated) and analytics.
    vi.doMock("@/lib/feature-flags", () => ({ isEnabled: () => true }));
    const track = vi.fn();
    vi.doMock("@/lib/analytics", () => ({ track }));
    const { default: GeldCheckClient } = await import("../app/geld-check/GeldCheckClient");

    render(<GeldCheckClient />);

    // Fill the bare minimum to get past validation: alleenstaand, 30j,
    // ruim onder de grens (zorgtoeslag → likely → bovengrens-bedrag getoond).
    fireEvent.change(screen.getByPlaceholderText(/bv\. 32/i), { target: { value: "30" } });
    fireEvent.change(screen.getByPlaceholderText(/bv\. 25\.000/i), { target: { value: "20000" } });
    fireEvent.click(screen.getByTestId("geld-check-submit"));

    const cta = await screen.findByTestId("geld-check-cross-cta");
    expect(cta).toBeInTheDocument();
    const link = cta.querySelector("a")!;
    expect(link).toHaveAttribute("href", "/onderhandel");
    expect(link.textContent).toMatch(/rekeningen/i);

    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("geld_check_to_onderhandel", { found: true });
  });
});
