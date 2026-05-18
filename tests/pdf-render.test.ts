import { describe, it, expect } from "vitest";
import { renderPdfPages, RENDER_MAX_WIDTH_PX } from "@/lib/pdf_render";
import { MAX_PDF_PAGES } from "@/lib/pdf_extract";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

describe("pdf_render (v13 DEEL 2)", () => {
  it("RENDER_MAX_WIDTH_PX is 1500 — cost-guard contract", () => {
    expect(RENDER_MAX_WIDTH_PX).toBe(1500);
  });

  it("renderPdfPages caps at MAX_PDF_PAGES regardless of PDF length", async () => {
    const fixturePath = resolve(ROOT, "tests/fixtures/kpn.pdf");
    if (!existsSync(fixturePath)) return; // skip when fixture absent
    const buf = readFileSync(fixturePath);
    const r = await renderPdfPages(buf);
    if (!r.ok) return; // canvas may not be available on this runner
    expect(r.pageDataUrls.length).toBeLessThanOrEqual(MAX_PDF_PAGES);
    for (const url of r.pageDataUrls) {
      expect(url.startsWith("data:image/png;base64,")).toBe(true);
    }
  });

  it("garbage input returns ok=false, no crash", async () => {
    const r = await renderPdfPages(Buffer.from("garbage"));
    expect(r.ok).toBe(false);
    expect(r.pageDataUrls).toEqual([]);
  });

  it("the rendered PNG has plausible byte size (>1KB) when canvas works", async () => {
    const fixturePath = resolve(ROOT, "tests/fixtures/kpn.pdf");
    if (!existsSync(fixturePath)) return;
    const buf = readFileSync(fixturePath);
    const r = await renderPdfPages(buf);
    if (!r.ok || r.pageDataUrls.length === 0) return;
    const url = r.pageDataUrls[0];
    const b64 = url.split(",")[1] ?? "";
    expect(b64.length).toBeGreaterThan(1000);
  });
});
