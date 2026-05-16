import Link from "next/link";
import { negotiationLabel, tierClass } from "@/lib/savings";
import { formatEurCents } from "@/lib/format";

export type ActiveNegotiationItem = {
  id: string;
  provider: string;
  category: string;
  state: string;
  amountCents: number;
  daysSinceSent: number | null;
};

export default function ActiveNegotiationCard({ item }: { item: ActiveNegotiationItem }) {
  const continueLabel =
    item.state === "EMAIL_GEN" || item.state === "EMAIL_SENT"
      ? "Ik kreeg antwoord →"
      : item.state === "RESPONSE_RECEIVED" || item.state === "COUNTER_SENT"
      ? "Volgende ronde →"
      : "Bekijk →";

  // For active negotiations the user should resume from the latest round step.
  // Pragmatic linking: anywhere that handles all states.
  const href = `/onderhandel/${item.id}/ronde/1`;

  return (
    <li className="p-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{item.provider}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierClass(item.state as never)}`}>
            {negotiationLabel(item.state as never)}
          </span>
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {formatEurCents(item.amountCents)} per maand
          {item.daysSinceSent != null && (
            <> · {item.daysSinceSent === 0 ? "vandaag verstuurd" : `${item.daysSinceSent} dag${item.daysSinceSent === 1 ? "" : "en"} sinds versturen`}</>
          )}
        </div>
      </div>
      <div className="mt-3 sm:mt-0">
        <Link
          href={href}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {continueLabel}
        </Link>
      </div>
    </li>
  );
}
