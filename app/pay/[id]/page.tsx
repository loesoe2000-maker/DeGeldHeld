import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * v41 — de betaalpagina is uitgezet: DeGeldHeld vraagt nergens meer geld.
 * Bewust een redirect en geen 404, zodat oude links en e-mails netjes
 * uitkomen in plaats van op een foutpagina.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect("/dashboard");
}
