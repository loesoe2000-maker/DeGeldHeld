import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, SavingsCardSkeleton, NegotiationListSkeleton, ComparisonSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import AnalyseLoading from "../app/onderhandel/analyse/loading";
import DashboardLoading from "../app/dashboard/loading";
import EmailLoading from "../app/onderhandel/email/loading";
import OnderhandelNotFound from "../app/onderhandel/[...catch]/page";

describe("ui-polish/Skeleton component family", () => {
  it("base Skeleton renders animate-pulse", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("SavingsCardSkeleton renders 3 cards", () => {
    const { container } = render(<SavingsCardSkeleton />);
    // grid of 3 cards
    expect(container.querySelectorAll(".rounded-xl").length).toBeGreaterThanOrEqual(3);
  });

  it("NegotiationListSkeleton renders 3 list rows", () => {
    const { container } = render(<NegotiationListSkeleton />);
    const items = container.querySelectorAll("li");
    expect(items.length).toBe(3);
  });

  it("ComparisonSkeleton has brand-coloured savings banner placeholder", () => {
    const { container } = render(<ComparisonSkeleton />);
    expect(container.querySelector(".bg-brand-50")).not.toBeNull();
  });
});

describe("ui-polish/loading.tsx pages", () => {
  it("AnalyseLoading renders heading + ComparisonSkeleton", () => {
    const { container } = render(<AnalyseLoading />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("DashboardLoading renders Savings + List skeletons", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
  });

  it("EmailLoading renders email-shaped placeholders", () => {
    const { container } = render(<EmailLoading />);
    expect(container.querySelector(".bg-brand-50")).not.toBeNull();
  });
});

describe("ui-polish/EmptyState", () => {
  it("renders headline + CTA link to /onderhandel", () => {
    render(<EmptyState />);
    expect(screen.getByText(/Nog geen onderhandelingen/)).toBeInTheDocument();
    const cta = screen.getByText(/Eerste onderhandeling starten/);
    expect(cta.closest("a")?.getAttribute("href")).toBe("/onderhandel");
  });
});

describe("ui-polish/Catch-all routing", () => {
  it("OnderhandelNotFound has user-recoverable links", () => {
    render(<OnderhandelNotFound />);
    expect(screen.getByText(/Start opnieuw/).closest("a")?.getAttribute("href")).toBe("/onderhandel");
  });
});

describe("ui-polish/mobile responsiveness sentinels", () => {
  it("Skeleton root has mobile-friendly utility classes", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.querySelector("div");
    expect(el?.className).toMatch(/rounded/);
    expect(el?.className).toMatch(/bg-slate/);
  });

  it("SavingsCardSkeleton uses responsive grid (sm:grid-cols-3)", () => {
    const { container } = render(<SavingsCardSkeleton />);
    expect(container.innerHTML).toMatch(/sm:grid-cols-3/);
  });

  it("NegotiationListSkeleton uses sm:flex layout for tablet+", () => {
    const { container } = render(<NegotiationListSkeleton />);
    expect(container.innerHTML).toMatch(/sm:flex/);
  });
});
