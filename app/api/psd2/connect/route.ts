import crypto from "crypto";
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

  // v39 CSRF-fix: state is een onvoorspelbare single-use nonce, vastgelegd in
  // een httpOnly-cookie. Voorheen was state de (raadbare) userId én optioneel
  // in de callback — klassieke OAuth login-CSRF: een aanvaller kon zijn eigen
  // bank-code onder de sessie van een slachtoffer laten inwisselen en zo
  // aanvaller-transacties in andermans bill-detectie injecteren.
  const nonce = crypto.randomBytes(24).toString("base64url");
  const redirectUri = `${APP_URL}/api/psd2/callback`;
  const url = getAuthUrl(nonce, redirectUri);
  const res = NextResponse.json({ url });
  res.cookies.set("psd2_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/psd2",
    maxAge: 600,
  });
  return res;
}
