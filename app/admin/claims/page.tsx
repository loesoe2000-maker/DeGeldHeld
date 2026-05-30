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

  const [box3, huur, energie, volmachten] = await Promise.all([
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
    prisma.volmacht.findMany({
      orderBy: [{ signedAt: "desc" }],
      take: 200,
      include: { user: { select: { email: true } } },
    }),
  ]);

  // Map (claimType:claimId) → actieve papier-volmacht voor per-claim-indicator.
  const volmachtMap = new Map<string, (typeof volmachten)[number]>();
  for (const v of volmachten) {
    if (v.revokedAt) continue;
    if (!v.signedDocumentUrl) continue;
    volmachtMap.set(`${v.claimType}:${v.claimId}`, v);
  }

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
          hasProof: c.proofStorageUrl != null,
          // Box 3 gaat via DigiD/Belastingdienst — geen SES-volmacht.
          volmacht: null,
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
          hasProof: c.uitspraakStorageUrl != null,
          volmacht: volmachtMap.get(`HuurServicekostenClaim:${c.id}`)
            ? { signedAt: volmachtMap.get(`HuurServicekostenClaim:${c.id}`)!.signedAt }
            : null,
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
          hasProof: c.uitspraakStorageUrl != null,
          volmacht: volmachtMap.get(`EnergieEindafrekeningClaim:${c.id}`)
            ? { signedAt: volmachtMap.get(`EnergieEindafrekeningClaim:${c.id}`)!.signedAt }
            : null,
        }))}
      />

      <VolmachtSection
        items={volmachten.map((v) => ({
          id: v.id,
          claimType: v.claimType,
          claimId: v.claimId,
          fullName: v.fullName,
          userEmail: v.user.email,
          signedAt: v.signedAt,
          hasScan: v.signedDocumentUrl != null,
          revoked: v.revokedAt != null,
          zaakIdentifier: v.zaakIdentifier,
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
  /** v37 — is er een bewijs-document opgeslagen (admin kan downloaden)? */
  hasProof: boolean;
  /** v37 — actieve papier-volmacht voor deze claim (null = geen/niet nodig). */
  volmacht: { signedAt: Date } | null;
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

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {c.hasProof ? (
                    <a
                      href={`/api/admin/claims/${type}/${c.id}/proof`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`admin-proof-${c.id}`}
                      className="rounded-md border border-brand-200 px-2 py-1 font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      📄 Bewijs bekijken
                    </a>
                  ) : (
                    <span className="text-slate-400">geen bewijs opgeslagen</span>
                  )}

                  {type !== "Box3Claim" ? (
                    c.volmacht ? (
                      <a
                        href={`/api/admin/volmacht/${type}/${c.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`admin-volmacht-${c.id}`}
                        className="rounded-md border border-emerald-200 px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        ✍️ Volmacht ({c.volmacht.signedAt.toLocaleDateString("nl-NL")})
                      </a>
                    ) : (
                      <span className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                        ⚠ geen volmacht
                      </span>
                    )
                  ) : null}
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

type VolmachtItem = {
  id: string;
  claimType: string;
  claimId: string;
  fullName: string;
  userEmail: string | null;
  signedAt: Date;
  hasScan: boolean;
  revoked: boolean;
  zaakIdentifier: string | null;
};

/**
 * v37 — overzicht van álle SES/papier-volmachten. Een ondertekende scan
 * (hasScan) is wat de Huurcommissie/Geschillencommissie accepteert; een
 * volmacht zonder scan is alleen consent-intentie.
 */
function VolmachtSection({ items }: { items: VolmachtItem[] }) {
  return (
    <section className="mt-12" data-testid="admin-section-volmacht">
      <h2 className="text-lg font-semibold text-slate-900">
        Volmachten{" "}
        <span className="text-sm font-normal text-slate-500">({items.length})</span>
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Een ondertekende scan is vereist voordat je namens de klant bij de
        Huurcommissie / Geschillencommissie kunt indienen.
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nog geen volmachten.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
          {items.map((v) => (
            <li key={v.id} data-testid={`admin-volmacht-row-${v.id}`} className="p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-slate-700">
                  <span className="font-medium">{v.fullName}</span>{" "}
                  <span className="text-xs text-slate-500">
                    · {v.userEmail ?? "(deleted)"} · {v.claimType.replace("Claim", "")}
                    {v.zaakIdentifier ? ` · ${v.zaakIdentifier}` : ""}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {v.signedAt.toLocaleDateString("nl-NL")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {v.revoked ? (
                  <span className="rounded-md bg-rose-100 px-2 py-1 font-semibold text-rose-700">
                    ingetrokken
                  </span>
                ) : v.hasScan ? (
                  <a
                    href={`/api/admin/volmacht/${v.claimType}/${v.claimId}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-emerald-200 px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    ✍️ Getekende scan bekijken
                  </a>
                ) : (
                  <span className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                    ⚠ nog geen getekende scan
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
