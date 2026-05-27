import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import {
  DOCUMENT_KIND_LABEL,
  formatBytes,
  type DocumentKind,
} from "@/lib/user-documents";
import DocumentUploadForm from "@/components/DocumentUploadForm";
import DocumentDeleteButton from "@/components/DocumentDeleteButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mijn documenten — DeGeldHeld",
  description:
    "Upload je huurcontract, energiecontract, loonstrook of aangifte één " +
    "keer en gebruik ze in elke claim of check.",
};

/**
 * v36 idee 4 — Document-vault overzichts-pagina. Auth-gated, flag-gated.
 * Wanneer de flag uit staat zien gebruikers een 'binnenkort'-melding zodat
 * het entrypoint niet stuk lijkt.
 */
export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/account/documents");
  const userId = (session.user as { id: string }).id;
  const flagOn = isEnabled("DOCUMENTS_VAULT_ENABLED");

  const docs = flagOn
    ? await prisma.userDocument.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          filename: true,
          sizeBytes: true,
          mimeType: true,
          storageUrl: true,
          note: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-10 sm:pt-14">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Mijn documenten
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Eén keer uploaden, overal hergebruiken
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Huurcontract, energiecontract, loonstrook, aangifte of beschikking:
          zet ze één keer in je vault en wij gebruiken ze in elke check of
          claim — zonder dat je opnieuw moet uploaden.
        </p>
      </header>

      {!flagOn ? (
        <section
          data-testid="documents-disabled"
          className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            Binnenkort beschikbaar
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            We ronden de privacy-review + de Vercel Blob-opslag-configuratie
            af. Zodra deze sectie aan staat kun je hier documenten uploaden
            die in elke claim hergebruikt worden.
          </p>
        </section>
      ) : (
        <>
          <section
            data-testid="documents-upload"
            className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/40 p-5"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Nieuw document uploaden
            </h2>
            <DocumentUploadForm />
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">
              Je documenten ({docs.length})
            </h2>

            {docs.length === 0 ? (
              <p
                data-testid="documents-empty"
                className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"
              >
                Nog niets in je vault. Upload hierboven je eerste document.
              </p>
            ) : (
              <ul
                data-testid="documents-list"
                className="mt-4 grid gap-3"
              >
                {docs.map((d) => (
                  <li
                    key={d.id}
                    data-testid={`document-${d.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                          {DOCUMENT_KIND_LABEL[d.kind as DocumentKind] ?? d.kind}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          <a
                            href={d.storageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-brand-300 underline-offset-4 hover:decoration-brand-600"
                          >
                            {d.filename}
                          </a>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatBytes(d.sizeBytes)} · {d.mimeType} ·
                          geüpload op{" "}
                          {d.createdAt.toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        {d.note ? (
                          <p className="mt-2 text-sm text-slate-700">{d.note}</p>
                        ) : null}
                      </div>
                      <DocumentDeleteButton documentId={d.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="mt-10 text-xs text-slate-500">
        Je documenten worden privaat opgeslagen via Vercel Blob (URL bevat een
        cryptografisch-willekeurig achtervoegsel). Alléén jij ziet ze via deze
        pagina. Verwijderen? Eén klik op de prullenbak — bestand én database-
        record worden direct gewist (AVG art. 17).
      </p>

      <div className="mt-6 text-center text-sm text-slate-500">
        <Link href="/account" className="underline">
          ← Terug naar account
        </Link>
      </div>
    </main>
  );
}
