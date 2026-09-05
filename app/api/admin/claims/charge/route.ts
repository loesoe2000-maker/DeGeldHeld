/**
 * POST /api/admin/claims/charge — UITGEZET per v41.
 *
 * DeGeldHeld is een volledig GRATIS platform: er wordt geen enkele fee meer
 * geïncasseerd. Deze route incasseerde tot v40 handmatig de fee op de drie
 * claim-types. Hij is bewust NIET verwijderd maar geeft 410 Gone:
 *  - de admin-gate blijft staan (geen informatielek over het bestaan ervan);
 *  - een verdwenen route zou 404's geven in bookmarks en smoke-tests;
 *  - terugzetten vereist een bewuste beslissing, geen git-revert van copy.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  void req;
  return NextResponse.json(
    {
      error: "Gone",
      reason: "fee-disabled",
      uitleg:
        "DeGeldHeld is gratis. Er wordt geen fee meer geïncasseerd, dus deze " +
        "actie bestaat niet meer.",
    },
    { status: 410 },
  );
}
