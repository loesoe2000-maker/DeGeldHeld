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
  it("rendert altijd de Plus-kaart by default", () => {
    render(<PostCheckCta fromCheck="geld" />);
    expect(screen.getByTestId("post-check-plus")).toBeInTheDocument();
    expect(screen.getByTestId("post-check-onderhandel")).toBeInTheDocument();
  });

  it("toonOnderhandel=false → alleen Plus-kaart", () => {
    render(<PostCheckCta fromCheck="geld" toonOnderhandel={false} />);
    expect(screen.getByTestId("post-check-plus")).toBeInTheDocument();
    expect(screen.queryByTestId("post-check-onderhandel")).not.toBeInTheDocument();
  });

  it("toonPlus=false → alleen onderhandel-kaart", () => {
    render(<PostCheckCta fromCheck="box3" toonPlus={false} />);
    expect(screen.queryByTestId("post-check-plus")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-check-onderhandel")).toBeInTheDocument();
  });

  it("toonPlus=false + toonOnderhandel=false → renders niets", () => {
    const { container } = render(
      <PostCheckCta fromCheck="ns" toonPlus={false} toonOnderhandel={false} />,
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
  it("Plus-body verschilt per source", () => {
    const bodies = new Set<string>();
    for (const src of SOURCES) {
      const { container, unmount } = render(<PostCheckCta fromCheck={src} />);
      const card = container.querySelector("[data-testid='post-check-plus']");
      bodies.add(card?.textContent ?? "");
      unmount();
    }
    expect(bodies.size).toBe(SOURCES.length); // élke source heeft unieke tekst
  });

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
  it("klik op Plus-kaart fired track('plus_cta_clicked') met juiste fromCheck", () => {
    render(<PostCheckCta fromCheck="box3" />);
    fireEvent.click(screen.getByTestId("post-check-plus"));
    expect(track).toHaveBeenCalledWith("plus_cta_clicked", { fromCheck: "box3" });
  });

  it("klik op Onderhandel-kaart fired track('onderhandel_cta_clicked') met juiste fromCheck", () => {
    render(<PostCheckCta fromCheck="zorgkosten" />);
    fireEvent.click(screen.getByTestId("post-check-onderhandel"));
    expect(track).toHaveBeenCalledWith("onderhandel_cta_clicked", { fromCheck: "zorgkosten" });
  });
});

describe("PostCheckCta — v35 huurcommissie + energie-claim sources", () => {
  it("huurcommissie: Plus-body noemt jaarafrekening / servicekosten + Onderhandel-body cross-link werkt", () => {
    render(<PostCheckCta fromCheck="huurcommissie" />);
    const plus = screen.getByTestId("post-check-plus");
    expect(plus.textContent).toMatch(/servicekosten|jaarafrekening/i);
    const onder = screen.getByTestId("post-check-onderhandel");
    expect(onder.textContent).toMatch(/vaste lasten|besparen|onderhandel/i);
  });

  it("energie-claim: Plus-body noemt eindafrekening / contract-jaar", () => {
    render(<PostCheckCta fromCheck="energie-claim" />);
    const plus = screen.getByTestId("post-check-plus");
    expect(plus.textContent).toMatch(/eindafrekening|contract|tarief/i);
  });

  it("v35 sources fired juiste analytics-event op klik", () => {
    render(<PostCheckCta fromCheck="huurcommissie" />);
    fireEvent.click(screen.getByTestId("post-check-plus"));
    expect(track).toHaveBeenCalledWith("plus_cta_clicked", { fromCheck: "huurcommissie" });

    render(<PostCheckCta fromCheck="energie-claim" />);
    fireEvent.click(screen.getAllByTestId("post-check-onderhandel")[1]);
    expect(track).toHaveBeenCalledWith("onderhandel_cta_clicked", { fromCheck: "energie-claim" });
  });
});

describe("PostCheckCta — hrefs", () => {
  it("Plus-kaart linkt naar /plus", () => {
    render(<PostCheckCta fromCheck="geld" />);
    expect(screen.getByTestId("post-check-plus")).toHaveAttribute("href", "/plus");
  });

  it("Onderhandel-kaart linkt naar /onderhandel", () => {
    render(<PostCheckCta fromCheck="geld" />);
    expect(screen.getByTestId("post-check-onderhandel")).toHaveAttribute("href", "/onderhandel");
  });
});
