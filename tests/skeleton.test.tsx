import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  SavingsCardSkeleton,
  NegotiationListSkeleton,
  ComparisonSkeleton,
} from "../components/Skeleton";

describe("components/Skeleton", () => {
  it("renders animated pulse element", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain("animate-pulse");
    expect(node.className).toContain("h-4");
    expect(node.getAttribute("aria-hidden")).toBe("true");
  });

  it("SavingsCardSkeleton renders 3 placeholder tiles", () => {
    const { container } = render(<SavingsCardSkeleton />);
    expect(container.querySelectorAll(".rounded-xl").length).toBeGreaterThanOrEqual(3);
  });

  it("NegotiationListSkeleton renders an ul with 3 items", () => {
    const { container } = render(<NegotiationListSkeleton />);
    const ul = container.querySelector("ul");
    expect(ul).toBeTruthy();
    expect(ul!.querySelectorAll("li").length).toBe(3);
  });

  it("ComparisonSkeleton renders current+banner placeholders", () => {
    const { container } = render(<ComparisonSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(4);
  });
});
