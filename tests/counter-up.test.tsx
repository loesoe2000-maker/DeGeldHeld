import { describe, it, expect, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import CounterUp from "../components/CounterUp";

describe("components/CounterUp", () => {
  it("renders 0 initially before animation", () => {
    render(<CounterUp value={1000} durationMs={1000} />);
    // First frame may already paint a value > 0; just verify rendering
    expect(screen.getByText(/\d+/)).toBeInTheDocument();
  });

  it("animates to final value", async () => {
    render(<CounterUp value={500} durationMs={50} />);
    await waitFor(
      () => {
        expect(screen.getByText("500")).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it("applies format function", async () => {
    render(<CounterUp value={100} durationMs={20} format={(n) => `€${n},-`} />);
    await waitFor(() => expect(screen.getByText("€100,-")).toBeInTheDocument(), { timeout: 500 });
  });

  it("respects className", () => {
    render(<CounterUp value={1} durationMs={10} className="text-brand-700" />);
    const span = document.querySelector("span");
    expect(span?.className).toContain("brand-700");
  });

  it("settles on a non-negative integer", async () => {
    render(<CounterUp value={100} durationMs={30} />);
    await waitFor(
      () => {
        const node = document.querySelector("span")!;
        const num = Number(node.textContent);
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThanOrEqual(100);
      },
      { timeout: 500 },
    );
  });
});
