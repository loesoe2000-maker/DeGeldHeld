import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../components/Toast";
import { useEffect } from "react";

function TriggerToast({ message, variant }: { message: string; variant?: "success" | "error" | "info" }) {
  const { toast } = useToast();
  useEffect(() => {
    toast(message, variant);
  }, [message, variant, toast]);
  return null;
}

describe("components/Toast", () => {
  it("renders nothing when no toasts", () => {
    render(
      <ToastProvider>
        <div>content</div>
      </ToastProvider>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    const region = screen.queryByRole("region");
    expect(region?.children.length ?? 0).toBe(0);
  });

  it("renders a success toast with brand class", async () => {
    render(
      <ToastProvider>
        <TriggerToast message="Hoera" variant="success" />
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByText("Hoera")).toBeInTheDocument());
    const node = screen.getByText("Hoera");
    expect(node.className).toContain("brand");
    expect(node.getAttribute("role")).toBe("status");
  });

  it("renders an error toast with role=alert and red class", async () => {
    render(
      <ToastProvider>
        <TriggerToast message="Fout" variant="error" />
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByText("Fout")).toBeInTheDocument());
    const node = screen.getByText("Fout");
    expect(node.className).toContain("red");
    expect(node.getAttribute("role")).toBe("alert");
  });

  it("renders an info toast (default variant)", async () => {
    render(
      <ToastProvider>
        <TriggerToast message="Even geduld" />
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByText("Even geduld")).toBeInTheDocument());
  });

  it("aria-live region is polite", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("noop when useToast used outside provider", () => {
    function Comp() {
      const { toast } = useToast();
      toast("test");
      return <span>ok</span>;
    }
    expect(() => render(<Comp />)).not.toThrow();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
