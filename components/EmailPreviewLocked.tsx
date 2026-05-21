import FeeMandatePrompt from "@/components/FeeMandatePrompt";
import { formatEurCents, formatPercent } from "@/lib/format";

/**
 * EmailPreviewLocked — shown when the user has NOT yet linked a fee card.
 *
 * Security: the FULL negotiation body is never passed here (and so never
 * reaches the browser/HTML source). The server sends only a short teaser.
 * The full, copyable email lives behind the no-cure-no-pay card mandate.
 */
export default function EmailPreviewLocked({
  subject,
  teaser,
  expectedSavingsCents,
  confidence,
  strategy,
  returnTo,
}: {
  subject: string;
  teaser: string;
  expectedSavingsCents: number;
  confidence: number;
  strategy?: string;
  returnTo: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="text-sm font-medium text-brand-700">Verwachte jaarlijkse besparing</div>
        <div className="mt-1 text-2xl font-bold text-brand-700">
          {formatEurCents(expectedSavingsCents, { showDecimals: false })}
        </div>
        <div className="mt-1 text-xs text-brand-700">
          Vertrouwen: {formatPercent(confidence)}
          {strategy && (
            <span className="ml-2 rounded-full bg-white/60 px-2 py-0.5 font-medium">
              {strategy.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Onderwerp
        </div>
        <div className="text-lg font-semibold text-slate-900">{subject}</div>
        <hr className="my-4" />
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Bericht (preview)
        </div>
        <pre className="whitespace-pre-wrap font-sans text-slate-800">{teaser}</pre>
        {/* Gradient fade hint that there's more */}
        <div className="pointer-events-none mt-1 h-12 bg-gradient-to-b from-transparent to-white" />
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-700">
          🔒 De <strong>volledige onderhandel-mail</strong> + kopieerknop staan
          klaar zodra je je kaart koppelt. Je betaalt nu <strong>€0</strong> —
          alleen 20% áls je écht bespaart.
        </div>
      </div>

      <FeeMandatePrompt returnTo={returnTo} />
    </div>
  );
}
