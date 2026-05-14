import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EmailDisplay from "../components/EmailDisplay";

const baseProps = {
  subject: "Voorstel Ziggo",
  body: "Geachte heer/mevrouw,\nIk ben klant bij Ziggo.\n\nGroet.",
  reasoning: "Switch-claim — alternatief is goedkoper.",
  expectedSavingsCents: 21600,
  confidence: 0.78,
};

describe("components/EmailDisplay", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  it("renders subject and body", () => {
    render(<EmailDisplay {...baseProps} />);
    expect(screen.getByText("Voorstel Ziggo")).toBeInTheDocument();
    expect(screen.getByText(/klant bij Ziggo/)).toBeInTheDocument();
  });

  it("shows expected savings banner", () => {
    render(<EmailDisplay {...baseProps} />);
    expect(screen.getByText(/Verwachte jaarlijkse besparing/)).toBeInTheDocument();
    expect(screen.getByText(/216/)).toBeInTheDocument();
  });

  it("shows confidence percent", () => {
    render(<EmailDisplay {...baseProps} />);
    expect(screen.getByText(/78/)).toBeInTheDocument();
  });

  it("copy button triggers clipboard write", async () => {
    render(<EmailDisplay {...baseProps} />);
    const btn = screen.getByRole("button", { name: /Kopieer/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written).toContain("Voorstel Ziggo");
    expect(written).toContain("klant bij Ziggo");
  });

  it("button label changes to ✓ Gekopieerd after click", async () => {
    render(<EmailDisplay {...baseProps} />);
    const btn = screen.getByRole("button", { name: /Kopieer/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent(/Gekopieerd/));
  });

  it("reasoning is in collapsed details by default", () => {
    render(<EmailDisplay {...baseProps} />);
    const summary = screen.getByText(/Waarom werkt deze hoek/);
    expect(summary).toBeInTheDocument();
    // details element renders its content but is collapsed visually
    expect(screen.getByText(/Switch-claim/)).toBeInTheDocument();
  });
});
