import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isWhatsAppEnabled } from "@/lib/whatsapp";
import WhatsAppClient from "@/components/WhatsAppClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp tracking — DeGeldHeld" };

export default async function WhatsAppPage({ params }: { params: Promise<{ billId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const { billId } = await params;

  const bill = await prisma.bill.findFirst({
    where: { id: billId, userId },
    include: { negotiation: { include: { whatsappThread: { include: { messages: { orderBy: { receivedAt: "asc" } } } } } } },
  });
  if (!bill || !bill.negotiation) notFound();

  const enabled = isWhatsAppEnabled();
  const thread = bill.negotiation.whatsappThread;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-slate-500">DeGeldHeld → {bill.provider} → WhatsApp</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">WhatsApp tracking</h1>
      <p className="mt-2 text-sm text-slate-600">
        Provider antwoordt via WhatsApp → wij detecteren binnen 60s → AI stelt counter voor.
        <strong> Counters worden nooit automatisch verstuurd.</strong> Jij beslist.
      </p>

      {!enabled && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900" data-testid="whatsapp-disabled">
          <strong>WhatsApp tracking nog niet geactiveerd.</strong> Twilio
          WhatsApp Business approval is in aanvraag. Zie MANUAL_SETUP_REQUIRED.md
          in de repo voor de stappen. Zodra <code>WHATSAPP_ENABLED=true</code> in
          Vercel staat, kun je hier provider-nummers activeren.
        </div>
      )}

      {enabled && (
        <WhatsAppClient
          negotiationId={bill.negotiation.id}
          billId={billId}
          provider={bill.provider}
          existingThread={thread ? {
            providerNumber: thread.providerNumber,
            messages: thread.messages.map((m) => ({
              id: m.id,
              direction: m.direction as "inbound" | "outbound",
              body: m.body,
              pendingApproval: m.pendingApproval,
              receivedAt: m.receivedAt.toISOString(),
            })),
          } : null}
        />
      )}

      <div className="mt-10 text-sm text-slate-500">
        <Link href={`/onderhandel/${billId}/historie`} className="underline">← Tijdlijn</Link>
      </div>
    </main>
  );
}
