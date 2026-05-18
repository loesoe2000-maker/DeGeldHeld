/**
 * Contract-level tests for the admin suspend / unflag flow. We test
 * the SOURCE files directly so the wire-up can't drift:
 *   - admin endpoints require isAdmin()
 *   - suspend writes BOTH User.suspendedAt and FraudFlag.resolved in
 *     one transaction
 *   - upload route gates on User.suspendedAt
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("admin/fraud endpoints — auth + atomicity", () => {
  const suspend = read("app/api/admin/fraud/[id]/suspend/route.ts");
  const unflag = read("app/api/admin/fraud/[id]/unflag/route.ts");

  it("suspend endpoint requires isAdmin()", () => {
    expect(suspend).toMatch(/isAdmin\(\)/);
    expect(suspend).toMatch(/403/);
  });

  it("unflag endpoint requires isAdmin()", () => {
    expect(unflag).toMatch(/isAdmin\(\)/);
    expect(unflag).toMatch(/403/);
  });

  it("suspend uses prisma.$transaction so both writes land together", () => {
    expect(suspend).toMatch(/prisma\.\$transaction/);
    expect(suspend).toMatch(/suspendedAt/);
    expect(suspend).toMatch(/resolved:\s*true/);
  });

  it("suspend writes suspendedReason for the audit trail", () => {
    expect(suspend).toMatch(/suspendedReason/);
    expect(suspend).toMatch(/fraud-flag/);
  });
});

describe("upload route blocks suspended users", () => {
  const src = read("app/api/bills/upload/route.ts");

  it("checks User.suspendedAt before allowing upload", () => {
    expect(src).toMatch(/suspendedAt/);
    expect(src).toMatch(/status:\s*403/);
  });

  it("the gate sits before rate-limiting (cheapest reject path first)", () => {
    const susIdx = src.indexOf("suspendedAt");
    const rlIdx = src.indexOf("rateLimit({");
    expect(susIdx).toBeGreaterThan(0);
    expect(rlIdx).toBeGreaterThan(0);
    expect(susIdx).toBeLessThan(rlIdx);
  });
});

describe("/admin/fraud page contract", () => {
  const src = read("app/admin/fraud/page.tsx");
  it("page requires isAdmin() and falls back to notFound()", () => {
    expect(src).toMatch(/isAdmin\(\)/);
    expect(src).toMatch(/notFound\(\)/);
  });
  it("renders both Open and Resolved sections", () => {
    expect(src).toMatch(/Open \(/);
    expect(src).toMatch(/Recent resolved/);
  });
});
