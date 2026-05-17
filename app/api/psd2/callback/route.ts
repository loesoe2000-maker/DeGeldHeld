import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exchangeCode, isPsd2Enabled } from "@/lib/psd2/tink";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(`${APP_URL}/login?from=/account/banks`);
  }
  if (!isPsd2Enabled()) {
    return NextResponse.json({ error: "PSD2 not enabled" }, { status: 503 });
  }
  const userId = (session.user as { id: string }).id;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${APP_URL}/account/banks?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  if (state && state !== userId) {
    return NextResponse.json({ error: "State mismatch" }, { status: 400 });
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
    return NextResponse.redirect(`${APP_URL}/account/banks?connected=1`);
  } catch (e) {
    return NextResponse.redirect(
      `${APP_URL}/account/banks?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
}
