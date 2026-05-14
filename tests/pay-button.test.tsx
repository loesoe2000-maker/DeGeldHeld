import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PayButton from "../components/PayButton";
import { ToastProvider } from "../components/Toast";

const originalLocation = window.location;

describe("components/PayButton", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });

  it("renders amount in label", () => {
    render(
      <ToastProvider>
        <PayButton negotiationId="n1" amountCents={3000} />
      </ToastProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent(/30,00/);
  });

  it("disables button while busy", async () => {
    (fetch as unknown as { mockImplementation: (f: () => unknown) => void }).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    render(
      <ToastProvider>
        <PayButton negotiationId="n1" amountCents={3000} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    expect(screen.getByRole("button")).toHaveTextContent(/Verbinden/);
  });

  it("redirects to checkoutUrl on success", async () => {
    (fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, checkoutUrl: "https://stripe.example/cs_123" }),
    });
    render(
      <ToastProvider>
        <PayButton negotiationId="n1" amountCents={3000} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(window.location.href).toBe("https://stripe.example/cs_123"));
  });

  it("shows error toast on failed checkout", async () => {
    (fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Geen besparing om te factureren" }),
    });
    render(
      <ToastProvider>
        <PayButton negotiationId="n1" amountCents={3000} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(/Geen besparing/)).toBeInTheDocument());
  });

  it("shows network error toast on fetch reject", async () => {
    (fetch as unknown as { mockRejectedValue: (v: unknown) => void }).mockRejectedValue(
      new Error("network"),
    );
    render(
      <ToastProvider>
        <PayButton negotiationId="n1" amountCents={3000} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(/Netwerkfout/)).toBeInTheDocument());
  });

  afterAll(() => {
    Object.defineProperty(window, "location", { value: originalLocation });
  });
});

import { afterAll } from "vitest";
