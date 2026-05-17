import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUrl, isPsd2Enabled } from "@/lib/psd2/tink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPsd2Enabled()) {
    return NextResponse.json({ error: "PSD2 not enabled in this environment" }, { status: 503 });
  }
  const userId = (session.user as { id: string }).id;
  const redirectUri = `${APP_URL}/api/psd2/callback`;
  const url = getAuthUrl(userId, redirectUri);
  return NextResponse.json({ url });
}
