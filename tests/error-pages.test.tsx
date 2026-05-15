import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "../app/not-found";
import GlobalError from "../app/error";
import OnderhandelNotFound from "../app/onderhandel/[...catch]/page";

describe("app/not-found.tsx (404)", () => {
  it("renders 404 visual + heading", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText(/Deze pagina bestaat niet/)).toBeInTheDocument();
  });

  it("includes 'Terug naar home' link", () => {
    render(<NotFound />);
    const link = screen.getByText(/Terug naar home/);
    expect(link).toBeInTheDocument();
    expect(link.closest("a")?.getAttribute("href")).toBe("/");
  });

  it("includes link to /onderhandel start", () => {
    render(<NotFound />);
    const link = screen.getByText(/Start onderhandeling/);
    expect(link.closest("a")?.getAttribute("href")).toBe("/onderhandel");
  });

  it("includes link to /faq", () => {
    render(<NotFound />);
    expect(screen.getByText(/Veelgestelde vragen/).closest("a")?.getAttribute("href")).toBe(
      "/faq",
    );
  });
});

describe("app/error.tsx (500/runtime error)", () => {
  it("renders error heading + retry button", () => {
    const reset = () => {};
    render(<GlobalError error={new Error("boom")} reset={reset} />);
    expect(screen.getByText(/Er ging iets mis/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Probeer opnieuw/ })).toBeInTheDocument();
  });

  it("shows support email link", () => {
    render(<GlobalError error={new Error("boom")} reset={() => {}} />);
    const mailto = screen.getByText(/hallo@degeldheld.nl/);
    expect(mailto.getAttribute("href")).toMatch(/^mailto:/);
  });

  it("renders error.digest when present", () => {
    const e = Object.assign(new Error("boom"), { digest: "DG-XYZ-001" });
    render(<GlobalError error={e} reset={() => {}} />);
    expect(screen.getByText(/DG-XYZ-001/)).toBeInTheDocument();
  });

  it("omits digest text when missing", () => {
    render(<GlobalError error={new Error("boom")} reset={() => {}} />);
    expect(screen.queryByText(/Foutcode:/)).not.toBeInTheDocument();
  });

  it("retry button calls reset", () => {
    let called = 0;
    render(<GlobalError error={new Error("boom")} reset={() => (called += 1)} />);
    const btn = screen.getByRole("button", { name: /Probeer opnieuw/ });
    btn.click();
    expect(called).toBe(1);
  });
});

describe("app/onderhandel catch-all", () => {
  it("renders heading", () => {
    render(<OnderhandelNotFound />);
    expect(screen.getByText(/Deze onderhandel-stap bestaat niet/)).toBeInTheDocument();
  });

  it("links back to /onderhandel start", () => {
    render(<OnderhandelNotFound />);
    expect(screen.getByText(/Start opnieuw/).closest("a")?.getAttribute("href")).toBe(
      "/onderhandel",
    );
  });

  it("links to dashboard", () => {
    render(<OnderhandelNotFound />);
    expect(screen.getByText(/Mijn dashboard/).closest("a")?.getAttribute("href")).toBe(
      "/dashboard",
    );
  });
});

describe("flow integrity (state machine)", () => {
  it("flow.ts canTransition is reachable (smoke)", async () => {
    const flow = await import("../lib/flow");
    expect(flow.canTransition("NIEUW", "BILL_UPLOAD")).toBe(true);
    expect(flow.canTransition("NIEUW", "SUCCESS")).toBe(false);
  });
});
