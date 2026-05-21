import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { signIn } from "next-auth/react";
import LoginPage from "@/app/login/page";

// The login form posts the magic-link via signIn(redirect:false) and renders
// the server gate's outcome inline (see app/api/auth/[...nextauth]/route.ts).
const mockSearch = { value: "" };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch.value),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

function fillAndSubmit(addr: string) {
  const input = screen.getByLabelText(/e-mailadres/i);
  fireEvent.change(input, { target: { value: addr } });
  fireEvent.submit(input.closest("form")!);
}

describe("LoginForm — magic-link send UX", () => {
  beforeEach(() => {
    mockSearch.value = "";
    vi.mocked(signIn).mockReset();
  });

  it("shows the check-inbox panel on a successful send", async () => {
    vi.mocked(signIn).mockResolvedValueOnce({ ok: true, error: undefined } as never);
    render(<LoginPage />);
    fillAndSubmit("real@user.com");
    expect(await screen.findByText(/Check je inbox/i)).toBeTruthy();
  });

  it("shows a clear rate-limit message when the gate returns rate_limited", async () => {
    vi.mocked(signIn).mockResolvedValueOnce({ ok: false, error: "rate_limited" } as never);
    render(<LoginPage />);
    fillAndSubmit("real@user.com");
    expect(await screen.findByText(/Te veel inlogpogingen/i)).toBeTruthy();
  });

  it("shows the blocked message for a bot-gated send", async () => {
    vi.mocked(signIn).mockResolvedValueOnce({ ok: false, error: "blocked" } as never);
    render(<LoginPage />);
    fillAndSubmit("real@user.com");
    expect(await screen.findByText(/geblokkeerd/i)).toBeTruthy();
  });

  it("surfaces ?error=rate_limited present on initial load", () => {
    mockSearch.value = "error=rate_limited";
    render(<LoginPage />);
    expect(screen.getByText(/Te veel inlogpogingen/i)).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });
});
