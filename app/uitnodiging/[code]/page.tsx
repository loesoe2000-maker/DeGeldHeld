import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { isValidCode } from "@/lib/referral";

export const dynamic = "force-dynamic";
export const metadata = { title: "Uitnodiging — DeGeldHeld" };

export default async function UitnodigingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!isValidCode(code.toUpperCase())) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Uitnodiging niet gevonden</h1>
        <p className="mt-3 text-slate-600">De link is ongeldig of verlopen.</p>
        <Link href="/" className="mt-6 inline-block text-brand-700 underline">Terug naar home</Link>
      </main>
    );
  }

  const owner = await prisma.user.findUnique({
    where: { referralCode: code.toUpperCase() },
    select: { name: true, email: true },
  });

  // Persist cookie zodat /login of /api/auth de referral kan oppikken bij signup.
  const jar = await cookies();
  jar.set("ref_code", code.toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60,
  });

  const naam = owner?.name ?? owner?.email?.split("@")[0] ?? "Een DeGeldHeld-klant";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-10 text-white">
        <div className="text-sm font-medium uppercase tracking-wider text-brand-100">Uitnodiging</div>
        <h1 className="mt-2 text-3xl font-bold">{naam} nodigt je uit voor DeGeldHeld</h1>
        <p className="mt-3 text-lg text-brand-50">
          Eerste onderhandeling helemaal gratis — geen creditcard nodig.
        </p>
        <Link
          href="/login"
          data-testid="referral-cta"
          className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-slate-100"
        >
          Aanmelden en gratis onderhandelen →
        </Link>
        <p className="mt-3 text-xs text-brand-100">Je code <code className="rounded bg-white/20 px-1.5">{code.toUpperCase()}</code> wordt automatisch gekoppeld.</p>
      </div>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Upload" body="Je laatste rekening van KPN, Eneco, Vodafone of een ander NL-bedrijf." />
        <Card title="AI onderhandelt" body="We schrijven jouw mail met concrete besparing en deadline." />
        <Card title="Jij stuurt" body="Kopieer + verstuur. Jij beslist en bewaakt je broker app." />
      </section>

      <div className="mt-10 text-center">
        <Link href="/demo" className="text-sm text-slate-600 underline">Liever eerst een demo bekijken?</Link>
      </div>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
