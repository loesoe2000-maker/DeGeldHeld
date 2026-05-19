import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureBillsClaimed } from "@/lib/ensure-claim";
import OnderhandelClient from "./OnderhandelClient";

export const dynamic = "force-dynamic";

export default async function OnderhandelPage() {
  // v15 page-level claim: if the user just signed up via magic-link
  // and still carries the dgh_anon_session cookie, reassign every
  // anonymous bill to their new user.id before we render. If a claim
  // produces at least one bill, jump straight into the email-page —
  // no need to upload anything again.
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  if (userId) {
    // v15.1: pass email so cross-browser magic-link clicks claim by the
    // stamped Bill.anonymousEmail even if the anon-cookie didn't survive
    // the email-client → default-browser jump.
    const claim = await ensureBillsClaimed(userId, userEmail);
    if (claim.firstBillId) {
      redirect(`/onderhandel/email?bill=${claim.firstBillId}`);
    }
  }
  return <OnderhandelClient />;
}
