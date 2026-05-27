import { describe, it, expect } from "vitest";
import {
  validateUpload,
  buildBlobPath,
  formatBytes,
  isDocumentKind,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KIND_HINT,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/user-documents";

/**
 * v36 idee 4 — Pure validation + helpers voor de document-vault.
 */

describe("isDocumentKind", () => {
  it("accepteert alle bekende kinds", () => {
    for (const k of DOCUMENT_KINDS) {
      expect(isDocumentKind(k)).toBe(true);
    }
  });
  it("weigert onbekende strings", () => {
    expect(isDocumentKind("password")).toBe(false);
    expect(isDocumentKind("")).toBe(false);
    expect(isDocumentKind(null)).toBe(false);
    expect(isDocumentKind(42)).toBe(false);
  });
});

describe("DOCUMENT_KIND_LABEL + HINT — totale dekking", () => {
  it("voor élke kind staat een NL label én een hint klaar", () => {
    for (const k of DOCUMENT_KINDS) {
      expect(DOCUMENT_KIND_LABEL[k]).toBeTruthy();
      expect(DOCUMENT_KIND_LABEL[k].length).toBeGreaterThan(2);
      expect(DOCUMENT_KIND_HINT[k]).toBeTruthy();
      expect(DOCUMENT_KIND_HINT[k].length).toBeGreaterThan(15);
    }
  });
});

describe("validateUpload", () => {
  const ok = {
    kind: "aangifte",
    filename: "aangifte-2024.pdf",
    sizeBytes: 256 * 1024,
    mimeType: "application/pdf",
  };

  it("happy path → ok=true", () => {
    const r = validateUpload(ok);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe("aangifte");
      expect(r.filename).toBe("aangifte-2024.pdf");
      expect(r.mimeType).toBe("application/pdf");
    }
  });

  it("onbekende kind → fout", () => {
    const r = validateUpload({ ...ok, kind: "wachtwoord" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/categorie/i);
  });

  it("lege filename → fout", () => {
    const r = validateUpload({ ...ok, filename: "  " });
    expect(r.ok).toBe(false);
  });

  it("te lange filename → fout", () => {
    const r = validateUpload({ ...ok, filename: "x".repeat(300) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/te lang/i);
  });

  it("size <= 0 → fout 'leeg'", () => {
    const r = validateUpload({ ...ok, sizeBytes: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/leeg/i);
  });

  it("size > 10MB → fout met MB-aanduiding", () => {
    const r = validateUpload({ ...ok, sizeBytes: MAX_FILE_SIZE_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/MB/);
  });

  it("mime executable → fout 'niet toegestaan'", () => {
    const r = validateUpload({ ...ok, mimeType: "application/x-msdownload" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/PDF, JPG of PNG/i);
  });

  it("png + jpg + pdf alle drie toegestaan", () => {
    for (const m of ["application/pdf", "image/jpeg", "image/png"]) {
      const r = validateUpload({ ...ok, mimeType: m });
      expect(r.ok).toBe(true);
    }
  });

  it("note > 500 chars → fout", () => {
    const r = validateUpload({ ...ok, note: "x".repeat(501) });
    expect(r.ok).toBe(false);
  });

  it("note van precies 500 chars → ok", () => {
    const r = validateUpload({ ...ok, note: "x".repeat(500) });
    expect(r.ok).toBe(true);
  });
});

describe("buildBlobPath", () => {
  it("prefix bevat userId zodat admin-listing per user makkelijk is", () => {
    const p = buildBlobPath("user_abc", "aangifte.pdf");
    expect(p).toMatch(/^user-documents\/user_abc\/\d+-aangifte\.pdf$/);
  });

  it("strip path-separators uit filename (defense in depth)", () => {
    const p = buildBlobPath("u", "../../etc/passwd");
    expect(p).not.toMatch(/\.\./);
    // Path-separators in de filename worden vervangen door underscores.
    expect(p.split("/").pop()).toMatch(/etc_passwd|_etc_passwd|\.\._\.\._etc_passwd/);
  });
});

describe("formatBytes", () => {
  it("< 1KB → bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
  it("< 1MB → KB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it(">= 1MB → MB", () => {
    expect(formatBytes(5_500_000)).toMatch(/MB$/);
  });
});
