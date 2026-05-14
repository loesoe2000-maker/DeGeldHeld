import { describe, it, expect } from "vitest";
import { validateClientFile } from "../components/BillUpload";

function fakeFile(opts: { name?: string; size: number; type: string }): File {
  return new File([new ArrayBuffer(opts.size)], opts.name ?? "f", { type: opts.type });
}

describe("BillUpload/validateClientFile", () => {
  it("accepts valid jpg under 10MB", () => {
    expect(validateClientFile(fakeFile({ size: 1_000_000, type: "image/jpeg" })).ok).toBe(true);
  });

  it("accepts png", () => {
    expect(validateClientFile(fakeFile({ size: 500, type: "image/png" })).ok).toBe(true);
  });

  it("accepts webp", () => {
    expect(validateClientFile(fakeFile({ size: 500, type: "image/webp" })).ok).toBe(true);
  });

  it("accepts heic", () => {
    expect(validateClientFile(fakeFile({ size: 500, type: "image/heic" })).ok).toBe(true);
  });

  it("accepts pdf", () => {
    expect(validateClientFile(fakeFile({ size: 500, type: "application/pdf" })).ok).toBe(true);
  });

  it("rejects empty file", () => {
    const r = validateClientFile(fakeFile({ size: 0, type: "image/jpeg" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/leeg/i);
  });

  it("rejects oversized file with size in error msg", () => {
    const r = validateClientFile(fakeFile({ size: 12 * 1024 * 1024, type: "image/jpeg" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/10\s*MB/);
      expect(r.error).toMatch(/12/);
    }
  });

  it("rejects unsupported types", () => {
    expect(validateClientFile(fakeFile({ size: 500, type: "text/plain" })).ok).toBe(false);
    expect(validateClientFile(fakeFile({ size: 500, type: "image/gif" })).ok).toBe(false);
    expect(validateClientFile(fakeFile({ size: 500, type: "video/mp4" })).ok).toBe(false);
  });

  it("case-insensitive on mime", () => {
    expect(validateClientFile(fakeFile({ size: 500, type: "IMAGE/JPEG" })).ok).toBe(true);
  });
});
