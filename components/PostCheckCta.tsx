"use client";

/**
 * v30 DEEL 3 — herbruikbaar CTA-blok onderaan élke gratis-check.
 *
 * Eén kaart richting Plus (her-scan-engine) + optioneel een kaart richting
 * /onderhandel (20% NCNP op bewezen besparing). PostHog-events maken
 * conversie meetbaar: `plus_cta_clicked` / `onderhandel_cta_clicked` per
 * `fromCheck`-source.
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
  | "energie-claim";

export type PostCheckCtaProps = {
  fromCheck: PostCheckSource;
  /** Optioneel — toon "we vonden tot € X" boven de kaarten. */
  vondstCents?: number | null;
  /** Label voor het bedrag, bv "toeslag mogelijk". */
  vondstLabel?: string;
  /** Standaard true. Zet false als de check zelf al naar /onderhandel verwijst. */
  toonOnderhandel?: boolean;
  /** Standaard true. */
  toonPlus?: boolean;
};

const PLUS_BODY: Record<PostCheckSource, string> = {
  geld:
    "Toeslagen-grenzen wijzigen elk jaar. Met Plus krijg je elk kwartaal een " +
    "her-check-herinnering — zodat je niets meer mist.",
  box3:
    "Box 3-forfaits + tarieven wijzigen jaarlijks. Met Plus volg je je open " +
    "claim tot de Belastingdienst-beschikking binnen is — automatisch.",
  ns:
    "Vergeet nooit meer een NS-claim: Plus seint binnen 1 maand vóór de " +
    "deadline zodat je geen €2-15 laat liggen per rit.",
  zorgkosten:
    "Drempel + 113%-AOW-verhoging wijzigen jaarlijks. Plus herinnert je in " +
    "januari aan de her-check zodra de nieuwe grenzen klaar staan.",
  vluchtclaim:
    "Reis je vaker? Plus herinnert je aan de 2-jaars EU261-verjaring voor " +
    "elke geregistreerde vlucht.",
  spookabonnementen:
    "Maandelijkse her-scan op je rekeningen — Plus mailt alleen áls er nieuwe " +
    "dubbele of onbenutte abonnementen opduiken.",
  huurcommissie:
    "Servicekosten worden elk jaar opnieuw afgerekend. Plus seint je in januari " +
    "wanneer de jaarafrekening verschijnt zodat je de check direct kunt doen.",
  "energie-claim":
    "Energieleveranciers wisselen tarieven + heffingen vaker dan je denkt. Plus " +
    "her-checkt je eindafrekeningen automatisch elk contract-jaar.",
};

const ONDERHANDEL_BODY: Record<PostCheckSource, string> = {
  geld:
    "Bovenop toeslagen kun je vaak nog €350-€800/jaar besparen op telecom / " +
    "internet / energie. Wij onderhandelen automatisch — 20% NCNP op bewezen " +
    "besparing.",
  box3:
    "Heb je naast Box 3 ook hoge vaste lasten? Upload je rekening — wij " +
    "onderhandelen 20% NCNP op bewezen besparing.",
  ns:
    "Bespaar ook op je vaste lasten: upload een rekening en wij onderhandelen " +
    "automatisch met je provider. 20% NCNP op bewezen besparing.",
  zorgkosten:
    "Vaste lasten checken is gratis: upload je rekening en wij onderhandelen " +
    "automatisch — 20% NCNP op bewezen besparing.",
  vluchtclaim:
    "Bespaar ook op je vaste lasten: upload een rekening en wij onderhandelen " +
    "automatisch. 20% NCNP op bewezen besparing.",
  spookabonnementen:
    "Voor de niet-spookabonnementen kunnen we vaak nog onderhandelen — upload " +
    "je rekening, 20% NCNP op bewezen besparing.",
  huurcommissie:
    "Servicekosten in orde gemaakt? Check ook of je op andere vaste lasten kunt " +
    "besparen — upload een rekening, 20% NCNP op bewezen besparing.",
  "energie-claim":
    "Eindafrekening teruggehaald? Check meteen of je nieuwe tarief ook scherp staat " +
    "— upload een rekening, 20% NCNP op bewezen besparing.",
};

export default function PostCheckCta({
  fromCheck,
  vondstCents,
  vondstLabel,
  toonOnderhandel = true,
  toonPlus = true,
}: PostCheckCtaProps) {
  if (!toonPlus && !toonOnderhandel) return null;
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
        En verder vinden we elke maand opnieuw…
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {toonPlus ? (
          <Link
            href="/plus"
            data-testid="post-check-plus"
            onClick={() => track("plus_cta_clicked", { fromCheck })}
            className="group rounded-xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md"
          >
            <div className="text-2xl" aria-hidden>
              🔁
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900">
              DeGeldHeld Plus — €4,99-€9,99/mnd
            </h3>
            <p className="mt-1 text-sm text-slate-600">{PLUS_BODY[fromCheck]}</p>
            <p className="mt-2 text-sm font-medium text-brand-700 group-hover:text-brand-800">
              Bekijk Plus →
            </p>
          </Link>
        ) : null}

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
