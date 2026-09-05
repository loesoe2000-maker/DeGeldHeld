"use client";

/**
 * v30 DEEL 3 — herbruikbaar CTA-blok onderaan élke gratis-check.
 *
 * v41 — GRATIS PLATFORM: de betaalde Plus-kaart is verwijderd. Wat overblijft
 * is één kaart richting /onderhandel — óók gratis. PostHog meet nog steeds
 * `onderhandel_cta_clicked` per `fromCheck`-source.
 */
import Link from "next/link";
import { track } from "@/lib/analytics";
import { formatEurCents } from "@/lib/format";

export type PostCheckSource =
  | "geld"
  | "box3"
  | "ns"
  | "zorgkosten"
  | "vluchtclaim"
  | "spookabonnementen"
  // v35 Claim-Hub uitbreiding — beide officiële-instantie-claims (geen relay-mail).
  | "huurcommissie"
  | "energie-claim"
  // v40 F3 — huurprijs-toets (WWS-punten → maximale huur).
  | "huurprijs";

export type PostCheckCtaProps = {
  fromCheck: PostCheckSource;
  /** Optioneel — toon "we vonden tot € X" boven de kaarten. */
  vondstCents?: number | null;
  /** Label voor het bedrag, bv "toeslag mogelijk". */
  vondstLabel?: string;
  /** Standaard true. Zet false als de check zelf al naar /onderhandel verwijst. */
  toonOnderhandel?: boolean;
};

const ONDERHANDEL_BODY: Record<PostCheckSource, string> = {
  huurprijs:
    "Naast je huur betaal je vaste lasten voor energie, internet en "
    + "verzekeringen. Upload een rekening en we onderhandelen mee.",
  geld:
    "Bovenop toeslagen kun je vaak nog €350-€800/jaar besparen op telecom / " +
    "internet / energie. Wij onderhandelen gratis met je provider.",
  box3:
    "Heb je naast Box 3 ook hoge vaste lasten? Upload je rekening — wij onderhandelen " +
    "gratis met je provider.",
  ns:
    "Bespaar ook op je vaste lasten: upload een rekening en wij onderhandelen " +
    "gratis met je provider.",
  zorgkosten:
    "Vaste lasten checken is gratis: upload je rekening en wij onderhandelen " +
    "gratis met je provider.",
  vluchtclaim:
    "Vliegen is duur, je vaste lasten hoeven dat niet te zijn. Upload een " +
    "rekening en wij onderhandelen gratis mee.",
  spookabonnementen:
    "Voor de niet-spookabonnementen kunnen we vaak nog onderhandelen — upload " +
    "je rekening, gratis.",
  huurcommissie:
    "Servicekosten in orde gemaakt? Check ook of je op andere vaste lasten " +
    "kunt besparen — upload je rekening, gratis.",
  "energie-claim":
    "Eindafrekening teruggehaald? Check meteen of je nieuwe tarief scherp " +
    "staat — upload je rekening, gratis.",
};

export default function PostCheckCta({
  fromCheck,
  vondstCents,
  vondstLabel,
  toonOnderhandel = true,
}: PostCheckCtaProps) {
  if (!toonOnderhandel) return null;
  return (
    <section
      data-testid="post-check-cta"
      data-from-check={fromCheck}
      className="mt-10 rounded-2xl border border-brand-200 bg-brand-50/40 p-6"
    >
      {vondstCents != null && vondstCents > 0 ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          We vonden tot {formatEurCents(vondstCents)}
          {vondstLabel ? ` ${vondstLabel}` : ""}
        </p>
      ) : null}
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        Nog iets waar je geld kunt terughalen?
      </h2>

      <div className="mt-4">
        {toonOnderhandel ? (
          <Link
            href="/onderhandel"
            data-testid="post-check-onderhandel"
            onClick={() => track("onderhandel_cta_clicked", { fromCheck })}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="text-2xl" aria-hidden>
              📄
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900">
              Of laat ons je rekeningen onderhandelen
            </h3>
            <p className="mt-1 text-sm text-slate-600">{ONDERHANDEL_BODY[fromCheck]}</p>
            <p className="mt-2 text-sm font-medium text-brand-700 group-hover:text-brand-800">
              Upload een rekening →
            </p>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
