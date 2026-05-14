import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SavingsCard from "../components/SavingsCard";
import EmptyState from "../components/EmptyState";
import NegotiationList from "../components/NegotiationList";

describe("components/SavingsCard", () => {
  it("renders all 3 stat tiles", () => {
    render(
      <SavingsCard
        stats={{
          totalSavedCents: 24000,
          totalSuccessful: 2,
          totalAttempts: 3,
          successRate: 0.6666,
          pendingCount: 1,
          averageSavingsCents: 12000,
        }}
      />,
    );
    expect(screen.getByText(/Totaal bespaard/i)).toBeInTheDocument();
    expect(screen.getByText(/Geslaagde onderhandelingen/i)).toBeInTheDocument();
    expect(screen.getByText(/In behandeling/i)).toBeInTheDocument();
  });

  it("formats euros in NL", () => {
    render(
      <SavingsCard
        stats={{
          totalSavedCents: 24000,
          totalSuccessful: 1,
          totalAttempts: 1,
          successRate: 1,
          pendingCount: 0,
          averageSavingsCents: 24000,
        }}
      />,
    );
    expect(screen.getByText(/240/)).toBeInTheDocument();
  });

  it("shows em-dash when no attempts", () => {
    render(
      <SavingsCard
        stats={{
          totalSavedCents: 0,
          totalSuccessful: 0,
          totalAttempts: 0,
          successRate: 0,
          pendingCount: 0,
          averageSavingsCents: 0,
        }}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("components/EmptyState", () => {
  it("shows CTA to start first negotiation", () => {
    render(<EmptyState />);
    expect(screen.getByText(/Nog geen onderhandelingen/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Eerste onderhandeling/i })).toHaveAttribute(
      "href",
      "/onderhandel",
    );
  });
});

describe("components/NegotiationList", () => {
  const baseItem = {
    id: "n1",
    userId: "u1",
    billId: "b1",
    state: "AWAITING" as const,
    emailSubject: null,
    emailBody: null,
    strategy: null,
    expectedSavingsCents: null,
    actualSavingsCents: null,
    confidence: null,
    reasoning: null,
    followUpAt: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    bill: { provider: "T-Mobile", amountCents: 4250, category: "TELECOM" as const },
  };

  it("renders empty fragment when items=[]", () => {
    const { container } = render(<NegotiationList items={[]} />);
    expect(container.querySelector("ul")).toBeNull();
  });

  it("renders one item with provider name", () => {
    render(<NegotiationList items={[baseItem]} />);
    expect(screen.getByText("T-Mobile")).toBeInTheDocument();
  });

  it("shows state label", () => {
    render(<NegotiationList items={[baseItem]} />);
    expect(screen.getByText(/Wacht op provider/i)).toBeInTheDocument();
  });

  it("shows actualSavings when present", () => {
    render(<NegotiationList items={[{ ...baseItem, state: "SUCCESS", actualSavingsCents: 18600 }]} />);
    expect(screen.getByText(/186/)).toBeInTheDocument();
  });

  it("links to negotiation detail", () => {
    render(<NegotiationList items={[baseItem]} />);
    expect(screen.getByRole("link", { name: /Bekijk/ })).toHaveAttribute(
      "href",
      "/onderhandel/n1",
    );
  });

  it("renders multiple items", () => {
    const second = { ...baseItem, id: "n2", bill: { ...baseItem.bill, provider: "Ziggo" } };
    render(<NegotiationList items={[baseItem, second]} />);
    expect(screen.getByText("T-Mobile")).toBeInTheDocument();
    expect(screen.getByText("Ziggo")).toBeInTheDocument();
  });
});
