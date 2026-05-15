import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import NetworkRetry from "../components/NetworkRetry";

describe("components/NetworkRetry", () => {
  let onlineDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    onlineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
  });

  afterEach(() => {
    if (onlineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", onlineDescriptor);
    }
  });

  it("renders nothing when online", () => {
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    const { container } = render(<NetworkRetry />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner when navigator goes offline", () => {
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    render(<NetworkRetry />);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/Geen internetverbinding/)).toBeInTheDocument();
  });

  it("hides banner on online event", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    render(<NetworkRetry />);
    expect(screen.getByText(/Geen internetverbinding/)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/Geen internetverbinding/)).not.toBeInTheDocument();
  });

  it("invokes onRetry callback when button clicked", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    const onRetry = vi.fn();
    render(<NetworkRetry onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Opnieuw"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits button when onRetry not provided", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    render(<NetworkRetry />);
    expect(screen.queryByText("Opnieuw")).not.toBeInTheDocument();
  });
});
