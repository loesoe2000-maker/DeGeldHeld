import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Capture Sentry calls — module is dynamically imported by the boundary,
// so we mock the bare module spec.
type CaptureOpts = { tags?: { area?: string }; extra?: Record<string, unknown> };
const captureException = vi.fn((_err: Error, _opts?: CaptureOpts): string => "evt-abc-123");
vi.mock("@sentry/nextjs", () => ({
  captureException: (err: Error, opts?: CaptureOpts) => captureException(err, opts),
}));

import ErrorBoundary from "../components/ErrorBoundary";

beforeEach(() => captureException.mockClear());

describe("components/ErrorBoundary", () => {
  it("renders the amber error banner", () => {
    render(
      <ErrorBoundary
        error={new Error("boom") as Error & { digest?: string }}
        reset={() => {}}
        area="dashboard"
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/iets mis/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /opnieuw/i })).toBeTruthy();
  });

  it("captures the error in Sentry with area tag", async () => {
    const err = new Error("test-failure") as Error & { digest?: string };
    err.digest = "DGST-1";
    render(<ErrorBoundary error={err} reset={() => {}} area="proof" />);

    await waitFor(() => expect(captureException).toHaveBeenCalled());
    const call = captureException.mock.calls[0];
    expect(call?.[0]?.message).toBe("test-failure");
    expect(call?.[1]?.tags?.area).toBe("proof");
  });

  it("uses 'unknown' tag when area not given", async () => {
    render(
      <ErrorBoundary
        error={new Error("x") as Error & { digest?: string }}
        reset={() => {}}
      />,
    );
    await waitFor(() => expect(captureException).toHaveBeenCalled());
    const call = captureException.mock.calls[0];
    expect(call?.[1]?.tags?.area).toBe("unknown");
  });

  it("shows Sentry event ID once captured", async () => {
    render(
      <ErrorBoundary
        error={new Error("x") as Error & { digest?: string }}
        reset={() => {}}
        area="dashboard"
      />,
    );
    await waitFor(() => expect(screen.getByText(/evt-abc-123/)).toBeTruthy());
  });

  it("falls back to digest when Sentry returns nothing", async () => {
    captureException.mockReturnValueOnce("");
    const err = new Error("x") as Error & { digest?: string };
    err.digest = "FALLBACK-DIGEST";
    render(<ErrorBoundary error={err} reset={() => {}} />);
    await waitFor(() => expect(screen.getByText(/FALLBACK-DIGEST/)).toBeTruthy());
  });
});
