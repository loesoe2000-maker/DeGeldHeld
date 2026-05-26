import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import { formatEurCents } from "@/lib/format";
import { feeForClaim, claimTypeLabel, type ClaimType } from "@/lib/admin-claims";
import AdminChargeButton from "./AdminChargeButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claims review — DeGeldHeld admin" };

/**
 * /admin/claims — V36 DEEL 1.
 *
 * Lijst van Box3Claim + HuurServicekostenClaim + EnergieEindafrekeningClaim.
 * Per claim: "Charge fee €X"-knop die /api/admin/claims/charge aanroept.
 * Audit via AdminAction-model — élke charge gelogd.
 *
 * Admin-gate via ADMIN_EMAILS (lib/admin_auth.isAdmin) — anders 404.
 */
export default async function AdminClaimsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isAdmin())) notFound();

  const [box3, huur, energie] = await Promise.all([
    prisma.box3Claim.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.huurServicekostenClaim.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.energieEindafrekeningClaim.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: { user: { select: { id: true, email: true } } },
    }),
  ]);

  const recentActions = await prisma.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Claims review</h1>
      <p className="mt-2 text-sm text-slate-600">
        Handmatige owner-review per claim. Charge-knop alléén actief als
        werkelijk teruggehaald-bedrag is ingevuld én status één van
        UITSPRAAK / PROOF_RECEIVED is. Élke actie wordt geaudit.
      </p>

      <ClaimSection
        title={claimTypeLabel("Box3Claim")}
        type="Box3Claim"
        items={box3.map((c) => ({
          id: c.id,
          userEmail: c.user.email,
          status: c.status,
          werkelijkeCents: c.werkelijkTeruggaveCents ?? null,
          verwachteCents: c.verwachteTeruggaveCents,
          createdAt: c.createdAt,
          extra: `Jaar ${c.jaar}`,
        }))}
      />
      <ClaimSection
        title={claimTypeLabel("HuurServicekostenClaim")}
        type="HuurServicekostenClaim"
        items={huur.map((c) => ({
          id: c.id,
          userEmail: c.user.email,
          status: c.status,
          werkelijkeCents: c.werkelijkeRestitutieCents,
          verwachteCents: c.verwachteRestitutieCents,
          createdAt: c.createdAt,
          extra: `Boekjaar ${c.boekjaar}` + (c.verhuurderNaam ? ` · ${c.verhuurderNaam}` : ""),
        }))}
      />
      <ClaimSection
        title={claimTypeLabel("EnergieEindafrekeningClaim")}
        type="EnergieEindafrekeningClaim"
        items={energie.map((c) => ({
          id: c.id,
          userEmail: c.user.email,
          status: c.status,
          werkelijkeCents: c.werkelijkeRestitutieCents,
          verwachteCents: c.verwachteRestitutieCents,
          createdAt: c.createdAt,
          extra: c.provider,
        }))}
      />

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Recente acties (audit-log)</h2>
        {recentActions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nog geen acties geregistreerd.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
            {recentActions.map((a) => (
              <li
                key={a.id}
                data-testid={`admin-action-${a.id}`}
                className="p-4 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">
                    {a.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      a.ok
                        ? "bg-brand-100 text-brand-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {a.ok ? "OK" : "FAIL"}
                  </span>
                </div>
                <div className="mt-1 text-slate-700">
                  <code className="text-xs">{a.adminEmail}</code> · {a.action} ·{" "}
                  <code className="text-xs">
                    {a.targetType}#{a.targetId.slice(0, 8)}
                  </code>
                  {a.errorMessage ? (
                    <span className="ml-2 text-rose-700">— {a.errorMessage}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type ClaimRow = {
  id: string;
  userEmail: string | null;
  status: string;
  werkelijkeCents: number | null;
  verwachteCents: number;
  createdAt: Date;
  extra: string;
};

function ClaimSection({
  title,
  type,
  items,
}: {
  title: string;
  type: ClaimType;
  items: ClaimRow[];
}) {
  return (
    <section className="mt-10" data-testid={`admin-section-${type}`}>
      <h2 className="text-lg font-semibold text-slate-900">
        {title} <span className="text-sm font-normal text-slate-500">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Geen claims.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
          {items.map((c) => {
            const feeCents = feeForClaim(type, c.werkelijkeCents);
            const chargeable =
              c.werkelijkeCents != null &&
              (c.status === "UITSPRAAK" || c.status === "PROOF_RECEIVED") &&
              feeCents > 0;
            return (
              <li
                key={c.id}
                data-testid={`admin-claim-${c.id}`}
                className="p-4 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <code className="text-xs text-slate-500">{c.id.slice(0, 8)}</code>
                    <span className="font-medium">{c.userEmail ?? "(deleted)"}</span>
                    <span className="text-xs text-slate-500">· {c.extra}</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {c.status}
                  </span>
                </div>
                <div className="mt-1 text-slate-700">
                  Verwacht: <strong>{formatEurCents(c.verwachteCents)}</strong>
                  {c.werkelijkeCents != null ? (
                    <>
                      {" "}· Werkelijk: <strong>{formatEurCents(c.werkelijkeCents)}</strong>
                      {" "}· Fee: <strong>{formatEurCents(feeCents)}</strong>
                    </>
                  ) : (
                    <span className="text-slate-500"> · (geen werkelijk-bedrag ingevuld)</span>
                  )}
                </div>
                {chargeable ? (
                  <AdminChargeButton
                    type={type}
                    claimId={c.id}
                    feeCents={feeCents}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
