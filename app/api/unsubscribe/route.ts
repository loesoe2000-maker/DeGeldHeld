/**
 * GET /api/unsubscribe?token=… — 1-click marketing opt-out.
 *
 * No auth: the token is the proof. Idempotent (a second click is fine).
 * Sets User.marketingOptOut = true and shows a plain confirmation page so
 * it works straight from an email client.
 */
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} — DeGeldHeld</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f1f5f9;margin:0;padding:48px 16px;color:#0f172a">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.05)">
<div style="font-size:22px;font-weight:bold;color:#059669;margin-bottom:16px">DeGeldHeld</div>
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<p style="line-height:1.5;color:#475569">${body}</p>
<p style="margin-top:24px"><a href="https://www.degeldheld.com/account" style="color:#059669">Naar je account-instellingen →</a></p>
</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return page("Ongeldige link", "Deze uitschrijf-link is niet geldig.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });
  if (!user) {
    // Idempotent + non-enumerable: don't leak whether the token existed.
    return page(
      "Je bent uitgeschreven",
      "Je ontvangt geen bespaar-tips en herinneringen meer. Je kunt dit altijd weer aanzetten in je account-instellingen.",
      200,
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { marketingOptOut: true },
  });

  return page(
    "Je bent uitgeschreven",
    "Je ontvangt geen bespaar-tips en herinneringen meer. Je krijgt nog wél belangrijke transactionele e-mails (bijv. over een lopende onderhandeling). Van gedachten veranderd? Zet het weer aan in je account-instellingen.",
    200,
  );
}
