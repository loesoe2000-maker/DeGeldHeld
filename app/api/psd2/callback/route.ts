import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exchangeCode, isPsd2Enabled } from "@/lib/psd2/tink";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

/** Single-use: de state-cookie wordt bij élke uitkomst gewist. */
function clearStateCookie<T extends NextResponse>(res: T): T {
  res.cookies.set("psd2_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/psd2",
    maxAge: 0,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(`${APP_URL}/login?from=/account/banks`);
  }
  if (!isPsd2Enabled()) {
    return NextResponse.json({ error: "PSD2 not enabled" }, { status: 503 });
  }
  const userId = (session.user as { id: string }).id;
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (error) {
    return clearStateCookie(
      NextResponse.redirect(`${APP_URL}/account/banks?error=${encodeURIComponent(error)}`),
    );
  }
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // v39 CSRF-fix: state is VERPLICHT en moet de nonce uit de httpOnly-cookie
  // zijn die /api/psd2/connect zette. De oude check (`state && state !==
  // userId`) was optioneel én voorspelbaar — login-CSRF: een aanvaller kon
  // zijn eigen Tink-code onder andermans sessie laten inwisselen.
  const expectedState = req.cookies.get("psd2_state")?.value ?? null;
  if (!state || !expectedState || state !== expectedState) {
    return clearStateCookie(NextResponse.json({ error: "State mismatch" }, { status: 400 }));
  }

  const redirectUri = `${APP_URL}/api/psd2/callback`;
  try {
    const tok = await exchangeCode(code, redirectUri);
    const expiresAt = new Date(Date.now() + tok.expires_in * 1000);
    await prisma.bankConnection.create({
      data: {
        userId,
        bankName: "Tink",
        accessTokenEnc: encryptToken(tok.access_token),
        refreshTokenEnc: tok.refresh_token ? encryptToken(tok.refresh_token) : null,
        expiresAt,
        status: "active",
      },
    });
    return clearStateCookie(NextResponse.redirect(`${APP_URL}/account/banks?connected=1`));
  } catch {
    // Generieke foutcode — geen exception-tekst in de redirect-URL lekken.
    return clearStateCookie(
      NextResponse.redirect(`${APP_URL}/account/banks?error=connect_failed`),
    );
  }
}
