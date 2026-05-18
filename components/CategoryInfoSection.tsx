import { infoFor, type CategoryInfo } from "@/lib/category-info";
import { PRIMARY_META, type PrimaryCategory } from "@/lib/categories";

/**
 * Rich category-info sectie — verschijnt onder de Comparison op
 * /onderhandel/analyse en op /[primary]-besparen SEO pages.
 *
 * Collapsible via <details>/<summary> zodat eerste-bezoek niet
 * overloaded raakt maar lezers die meer willen weten 't kunnen
 * openen zonder route-change.
 */
export default function CategoryInfoSection({
  primary,
  info,
}: {
  primary: PrimaryCategory;
  info?: CategoryInfo;
}) {
  const data = info ?? infoFor(primary);
  const meta = PRIMARY_META[primary];

  return (
    <section
      data-testid={`cat-info-${primary.toLowerCase()}`}
      className="mt-8 rounded-xl border border-slate-200 bg-white p-5"
    >
      <details>
        <summary className="cursor-pointer text-base font-semibold text-slate-900">
          {data.icon} Hoe werkt {meta.label.toLowerCase()} onderhandelen?
        </summary>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <p>{data.marketDescription}</p>

          <div>
            <h3 className="font-semibold text-slate-900">Realistisch te besparen</h3>
            <div className="mt-2 flex items-center gap-3">
              <div
                data-testid="savings-range-bar"
                aria-label={`Besparingsrange ${data.savingsRangeLabel}`}
                className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full bg-gradient-to-r from-emerald-300 to-emerald-600"
                  style={{ width: `${Math.round(data.averageSavingsPct * 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-emerald-700">
                {data.savingsRangeLabel}
              </span>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">Tips om te besparen</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.howToSave.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>

          {data.warningSigns.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900">
                Signalen dat je te veel betaalt
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-700">
                {data.warningSigns.map((sign, i) => (
                  <li key={i}>{sign}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
