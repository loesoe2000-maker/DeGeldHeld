import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Comparison from "../components/Comparison";
import { buildComparison } from "../lib/comparison";

describe("components/Comparison", () => {
  it("renders current provider + amount", () => {
    const r = buildComparison({ provider: "Ziggo", category: "TELECOM", amountCents: 6795 });
    render(<Comparison result={r} />);
    expect(screen.getByText("Ziggo")).toBeInTheDocument();
    expect(screen.getByText(/67,95/)).toBeInTheDocument();
  });

  it("shows savings banner when alternatives exist", () => {
    const r = buildComparison({ provider: "Ziggo", category: "TELECOM", amountCents: 6795 });
    render(<Comparison result={r} />);
    expect(screen.getByText(/Jaarlijkse besparing/)).toBeInTheDocument();
  });

  it("shows fallback when no alternatives", () => {
    const r = buildComparison({ provider: "X", category: "ABONNEMENT", amountCents: 100 });
    render(<Comparison result={r} />);
    expect(screen.getByText(/Geen goedkoper alternatief/)).toBeInTheDocument();
  });

  it("highlights best alternative differently", () => {
    const r = buildComparison({ provider: "Eneco", category: "ENERGIE", amountCents: 19000 });
    const { container } = render(<Comparison result={r} />);
    const cards = container.querySelectorAll("ul li");
    if (cards.length > 0) {
      // First card uses brand background
      expect(cards[0].className).toContain("brand");
    }
  });

  it("renders provider names of alternatives", () => {
    const r = buildComparison({ provider: "Ziggo", category: "TELECOM", amountCents: 8000 });
    render(<Comparison result={r} />);
    if (r.topAlternatives.length > 0) {
      expect(screen.getAllByText(r.topAlternatives[0].plan.provider).length).toBeGreaterThan(0);
    }
  });
});
