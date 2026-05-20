import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * v20 DEEL 3 — IDOR / authorization audit.
 *
 * Two layers:
 *  1. A functional ownership test against /api/bills/[id] DELETE with a
 *     stateful prisma mock — user B must never be able to act on user A's
 *     resource by guessing its id.
 *  2. A source-level guard that walks EVERY sensitive resource route and
 *     asserts it scopes by the caller (userId / anonymousSessionId /
 *     HMAC-token) or enforces isAdmin — so a future kale
 *     findUnique({ where: { id } }) that returns data is caught here.
 */

// ---- 1. functional ownership: bills/[id] DELETE ------------------------

type Bill = { id: string; userId: string | null; deletedAt: Date | null };
let bills: Bill[] = [];
let currentUserId: string | null = null;

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => (currentUserId ? { user: { id: currentUserId } } : null)),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    bill: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        return bills.find((b) => b.id === where.id && b.userId === where.userId) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Bill> }) => {
        const row = bills.find((b) => b.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
    },
  },
}));

import { DELETE } from "@/app/api/bills/[id]/route";

beforeEach(() => {
  bills = [{ id: "bill_A", userId: "user_A", deletedAt: null }];
  currentUserId = null;
});

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("v20 IDOR — /api/bills/[id] DELETE ownership", () => {
  it("401 when not signed in", async () => {
    const res = await DELETE(new Request("https://t/api/bills/bill_A"), ctx("bill_A"));
    expect(res.status).toBe(401);
    expect(bills[0].deletedAt).toBeNull();
  });

  it("user B cannot delete user A's bill → 404, bill untouched", async () => {
    currentUserId = "user_B";
    const res = await DELETE(new Request("https://t/api/bills/bill_A"), ctx("bill_A"));
    expect(res.status).toBe(404);
    expect(bills[0].deletedAt).toBeNull(); // never soft-deleted
  });

  it("owner can delete their own bill → 200, soft-deleted", async () => {
    currentUserId = "user_A";
    const res = await DELETE(new Request("https://t/api/bills/bill_A"), ctx("bill_A"));
    expect(res.status).toBe(200);
    expect(bills[0].deletedAt).toBeInstanceOf(Date);
  });
});

// ---- 2. source-level audit across all sensitive routes -----------------

const ROOT = resolve(__dirname, "..");
function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/**
 * Routes that read/mutate a user-owned resource by id. Each must scope the
 * lookup to the caller — by userId, anonymousSessionId, or an HMAC token
 * bound to the resource — never a bare id lookup that returns the data.
 */
const OWNER_SCOPED_ROUTES = [
  "app/api/bills/[id]/route.ts",
  "app/api/negotiations/[id]/feedback/route.ts",
  "app/api/negotiations/round/route.ts",
  "app/api/negotiations/sent/route.ts",
  "app/api/negotiations/round/[id]/confirm-send/route.ts",
  "app/api/outcome/[id]/proof/route.ts",
  "app/api/negotiations/outcome/route.ts",
  "app/api/checkout/route.ts",
  "app/api/whatsapp/activate/route.ts",
  "app/api/outbound/whatsapp/route.ts",
];

describe("v20 IDOR — every owner-scoped route checks ownership", () => {
  for (const route of OWNER_SCOPED_ROUTES) {
    it(`${route} scopes by caller (userId / anonymousSessionId / token)`, () => {
      const s = src(route);
      const scoped =
        /where:\s*\{[^}]*userId/.test(s) || // findFirst({ where: { id, userId } })
        /\{[^{}]*\buserId\b[^{}]*\}/.test(s) || // a where-object literal carrying userId
        /\.userId\s*!==/.test(s) || // explicit owner !== caller compare → 403/404
        /anonymousSessionId/.test(s) ||
        /verifyOutcomeToken/.test(s); // HMAC token bound to the resource
      expect(scoped, `${route} must scope the resource to the caller`).toBe(true);
    });
  }
});

const ADMIN_ROUTES = [
  "app/api/admin/fraud/[id]/suspend/route.ts",
  "app/api/admin/fraud/[id]/unflag/route.ts",
  "app/api/admin/training/route.ts",
  "app/api/admin/seed-success/route.ts",
  "app/api/providers/candidates/[id]/route.ts",
];

describe("v20 IDOR — admin routes enforce ADMIN_EMAILS, not just login", () => {
  for (const route of ADMIN_ROUTES) {
    it(`${route} calls isAdmin()`, () => {
      const s = src(route);
      expect(s).toMatch(/isAdmin\s*\(/);
    });
  }

  it("isAdmin() checks the email against ADMIN_EMAILS (not mere session presence)", () => {
    const s = src("lib/admin_auth.ts");
    expect(s).toMatch(/ADMIN_EMAILS/);
    expect(s).toMatch(/session\?\.user\?\.email/);
  });
});

describe("v20 IDOR — anonymous bills are session-scoped on the analyse page", () => {
  it("analyse page loads anonymous bills by { id, anonymousSessionId }", () => {
    const s = src("app/onderhandel/analyse/page.tsx");
    // logged-in path scopes by userId, anonymous path by the session cookie
    expect(s).toMatch(/where:\s*\{\s*id:\s*billId,\s*userId\s*\}/);
    expect(s).toMatch(/where:\s*\{\s*id:\s*billId,\s*anonymousSessionId\s*\}/);
  });
});
