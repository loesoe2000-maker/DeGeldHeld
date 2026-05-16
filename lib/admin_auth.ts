/**
 * Minimal admin gate via env var ADMIN_EMAILS (comma-separated list).
 * Used for /admin/* pages and admin-only API endpoints.
 */

import { auth } from "@/lib/auth";

export async function isAdmin(): Promise<boolean> {
  const list = (process.env.ADMIN_EMAILS ?? "").toLowerCase();
  if (!list) return false;
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return false;
  return list
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .includes(email);
}
