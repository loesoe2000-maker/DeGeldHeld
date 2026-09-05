import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PostCheckCta, { type PostCheckSource } from "@/components/PostCheckCta";

/**
 * v30 DEEL 3b — PostCheckCta component (gedeeld door alle 6 check-Clients).
 */

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));

beforeEach(() => {
  track.mockReset();
});

const SOURCES: PostCheckSource[] = [
  "geld",
  "box3",
  "ns",
  "zorgkosten",
  "vluchtclaim",
  "spookabonnementen",
  // v35 Claim-Hub uitbreiding
  "huurcommissie",
  "energie-claim",
];

describe("PostCheckCta — render", () => {
  it("v41 GRATIS: de betaalde Plus-kaart bestaat niet meer", () => {
    render(<PostCheckCta fromCheck="geld" />);
    expect(screen.queryByTestId("post-check-plus")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-check-onderhandel")).toBeInTheDocument();
  });

  it("toonOnderhandel=false → renders niets", () => {
    const { container } = render(
      <PostCheckCta fromCheck="ns" toonOnderhandel={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("vondstCents > 0 → toont '€ X' header met vondstLabel", () => {
    render(
      <PostCheckCta fromCheck="geld" vondstCents={12_900} vondstLabel="toeslag mogelijk/mnd" />,
    );
    expect(screen.getByText(/€ 129/)).toBeInTheDocument();
    expect(screen.getByText(/toeslag mogelijk/i)).toBeInTheDocument();
  });

  it("vondstCents null of 0 → géén € header (geen verzonnen 'we vonden €0')", () => {
    render(<PostCheckCta fromCheck="ns" vondstCents={null} />);
    expect(screen.queryByText(/€\s*0/)).not.toBeInTheDocument();
    render(<PostCheckCta fromCheck="ns" vondstCents={0} />);
    expect(screen.queryByText(/We vonden tot € 0/)).not.toBeInTheDocument();
  });
});

describe("PostCheckCta — per fromCheck unieke copy", () => {
  it("Onderhandel-body verschilt per source", () => {
    const bodies = new Set<string>();
    for (const src of SOURCES) {
      const { container, unmount } = render(<PostCheckCta fromCheck={src} />);
      const card = container.querySelector("[data-testid='post-check-onderhandel']");
      bodies.add(card?.textContent ?? "");
      unmount();
    }
    expect(bodies.size).toBe(SOURCES.length);
  });
});

describe("PostCheckCta — analytics", () => {
  it("klik op Onderhandel-kaart fired track('onderhandel_cta_clicked') met juiste fromCheck", () => {
    render(<PostCheckCta fromCheck="zorgkosten" />);
    fireEvent.click(screen.getByTestId("post-check-onderhandel"));
    expect(track).toHaveBeenCalledWith("onderhandel_cta_clicked", { fromCheck: "zorgkosten" });
  });
});

describe("PostCheckCta — v41: elke bron heeft eigen gratis copy", () => {
  it("huurcommissie en energie-claim hebben eigen onderhandel-tekst, zonder fee", () => {
    for (const src of ["huurcommissie", "energie-claim"] as const) {
      const { container, unmount } = render(<PostCheckCta fromCheck={src} />);
      const kaart = container.querySelector("[data-testid='post-check-onderhandel']");
      expect(kaart?.textContent ?? "").toMatch(/gratis/i);
      expect(kaart?.textContent ?? "").not.toMatch(/20%|NCNP|no.?cure/i);
      unmount();
    }
  });
});
