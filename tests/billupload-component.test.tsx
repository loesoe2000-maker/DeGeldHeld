import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BillUpload from "../components/BillUpload";

describe("components/BillUpload", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders drag-and-drop zone with hint text", () => {
    render(<BillUpload />);
    expect(screen.getByText(/Sleep je rekening hierheen/)).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG/)).toBeInTheDocument();
  });

  it("rejects oversized file (>10MB)", async () => {
    render(<BillUpload />);
    const input = document.getElementById("bill-file") as HTMLInputElement;
    const big = new File(["x".repeat(11_000_000)], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [big], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/10\s*MB/);
  });

  it("rejects non-image file", async () => {
    render(<BillUpload />);
    const input = document.getElementById("bill-file") as HTMLInputElement;
    const pdf = new File(["x"], "x.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { value: [pdf], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("calls onUploaded callback on success", async () => {
    (fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ ok: true, billId: "b1", needsManual: false }),
      json: async () => ({ ok: true, billId: "b1", needsManual: false }),
    });
    const onUploaded = vi.fn();
    render(<BillUpload onUploaded={onUploaded} />);
    const input = document.getElementById("bill-file") as HTMLInputElement;
    const f = new File(["x"], "f.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [f], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(onUploaded.mock.calls[0][0].billId).toBe("b1");
  });

  it("shows error from server response", async () => {
    (fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ error: "Upload mislukt" }),
      json: async () => ({ error: "Upload mislukt" }),
    });
    render(<BillUpload />);
    const input = document.getElementById("bill-file") as HTMLInputElement;
    const f = new File(["x"], "f.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [f], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
