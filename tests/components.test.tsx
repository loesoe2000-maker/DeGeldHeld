import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Hero from "../components/Hero";
import Problem from "../components/Problem";
import HowItWorks from "../components/HowItWorks";
import Examples from "../components/Examples";
import FAQ from "../components/FAQ";
import Footer from "../components/Footer";

describe("components/Hero", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders headline and CTA", () => {
    render(<Hero />);
    expect(screen.getByText(/Houd je geld in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Word lid/i })).toBeInTheDocument();
  });

  it("renders accessible email input", () => {
    render(<Hero />);
    const inp = screen.getByLabelText(/E-mailadres/i);
    expect(inp).toHaveAttribute("type", "email");
    expect(inp).toBeRequired();
  });

  it("submits email and shows success state", async () => {
    (fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    render(<Hero />);
    fireEvent.change(screen.getByLabelText(/E-mailadres/i), {
      target: { value: "test@example.nl" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Word lid/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(screen.getByRole("status").textContent).toMatch(/lijst/i);
  });

  it("shows error state on failed submit", async () => {
    (fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Ongeldig" }),
    });
    render(<Hero />);
    fireEvent.change(screen.getByLabelText(/E-mailadres/i), {
      target: { value: "x@y.nl" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Word lid/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("shows network error on fetch reject", async () => {
    (fetch as unknown as { mockRejectedValue: (v: unknown) => void }).mockRejectedValue(
      new Error("network"),
    );
    render(<Hero />);
    fireEvent.change(screen.getByLabelText(/E-mailadres/i), { target: { value: "x@y.nl" } });
    fireEvent.click(screen.getByRole("button", { name: /Word lid/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});

describe("components/Problem", () => {
  it("renders 3 problem cards", () => {
    render(<Problem />);
    expect(screen.getByText(/Loyale klanten/)).toBeInTheDocument();
    expect(screen.getByText(/kost tijd/i)).toBeInTheDocument();
    expect(screen.getByText(/Markt verandert/)).toBeInTheDocument();
  });

  it("has h2 heading", () => {
    render(<Problem />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});

describe("components/HowItWorks", () => {
  it("renders 4 numbered steps", () => {
    render(<HowItWorks />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("uses ordered list for steps", () => {
    const { container } = render(<HowItWorks />);
    expect(container.querySelector("ol")).toBeTruthy();
  });
});

describe("components/Examples", () => {
  it("renders 3 example cases", () => {
    render(<Examples />);
    expect(screen.getByText(/T-Mobile/)).toBeInTheDocument();
    expect(screen.getByText(/Ziggo/)).toBeInTheDocument();
    expect(screen.getByText(/Eneco/)).toBeInTheDocument();
  });

  it("links to /api/proof", () => {
    render(<Examples />);
    const link = screen.getByRole("link", { name: /api\/proof/i });
    expect(link).toHaveAttribute("href", "/api/proof");
  });
});

describe("components/FAQ", () => {
  it("renders all 6 questions", () => {
    render(<FAQ />);
    expect(screen.getByText(/Wat kost het/i)).toBeInTheDocument();
    expect(screen.getByText(/AFM/i)).toBeInTheDocument();
  });

  it("first item is open by default", () => {
    render(<FAQ />);
    const button = screen.getByRole("button", { name: /Wat kost het/i });
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles open state on click", () => {
    render(<FAQ />);
    const second = screen.getByRole("button", { name: /Welke providers/i });
    expect(second).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
  });
});

describe("components/Footer", () => {
  it("renders the brand name", () => {
    render(<Footer />);
    expect(screen.getByText("DeGeldHeld")).toBeInTheDocument();
  });

  it("has links to legal pages", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /Voorwaarden/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy/i })).toBeInTheDocument();
  });

  it("shows current year in copyright", () => {
    render(<Footer />);
    const year = String(new Date().getFullYear());
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
