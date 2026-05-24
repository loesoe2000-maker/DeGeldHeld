/**
 * lib/plus-rescan.ts — v30 Plus maandelijkse her-scan engine.
 *
 * Pure functies + één unawaited dependency (PrismaClient via opts) zodat de
 * cron-route makkelijk testbaar is. Verzonnen cijfers? Nooit — élk bedrag in
 * de delta komt uit een check-engine die zelf uit V29_DATA_2026.md leest.
 *
 * Persistence-format `PlusRescan.findingsJson`:
 *   { nieuw: Finding[], gewijzigd: Finding[], verdwenen: Finding[] }
 */

export type RescanFindingKind = "toeslag" | "box3" | "zorgkosten" | "spookabonnement";

export type RescanFinding = {
  kind: RescanFindingKind;
  /** Stable id zodat we delta tussen runs kunnen berekenen. */
  id: string;
  /** Kop in de mail/UI — concrete bewoording, geen marketing-speak. */
  label: string;
  /** Bovengrens-indicatie per maand (cents). null = geen schatting. */
  maandIndicatieCents: number | null;
};

export type RescanDelta = {
  nieuw: RescanFinding[];
  gewijzigd: RescanFinding[];
  verdwenen: RescanFinding[];
};

/** Lege delta is `nothing to notify`. */
export function isEmptyDelta(d: RescanDelta): boolean {
  return d.nieuw.length === 0 && d.gewijzigd.length === 0 && d.verdwenen.length === 0;
}

/** Diff twee snapshots tot een delta. Stabiel op `id`. */
export function diffFindings(
  prev: ReadonlyArray<RescanFinding>,
  curr: ReadonlyArray<RescanFinding>,
): RescanDelta {
  const prevMap = new Map(prev.map((f) => [f.id, f] as const));
  const currMap = new Map(curr.map((f) => [f.id, f] as const));
  const nieuw: RescanFinding[] = [];
  const gewijzigd: RescanFinding[] = [];
  const verdwenen: RescanFinding[] = [];
  for (const f of curr) {
    const p = prevMap.get(f.id);
    if (!p) {
      nieuw.push(f);
      continue;
    }
    if (p.maandIndicatieCents !== f.maandIndicatieCents || p.label !== f.label) {
      gewijzigd.push(f);
    }
  }
  for (const f of prev) {
    if (!currMap.has(f.id)) verdwenen.push(f);
  }
  return { nieuw, gewijzigd, verdwenen };
}

/** NL e-mail-tekst voor een delta — concreet, géén marketing-speak. */
export function formatRescanFindings(delta: RescanDelta): { subject: string; text: string } {
  const lines: string[] = [];
  function fmt(c: number | null): string {
    if (c == null) return "";
    return ` — tot € ${(c / 100).toLocaleString("nl-NL")}/mnd`;
  }
  if (delta.nieuw.length > 0) {
    lines.push("Nieuw deze maand:");
    for (const f of delta.nieuw) lines.push(`  • ${f.label}${fmt(f.maandIndicatieCents)}`);
  }
  if (delta.gewijzigd.length > 0) {
    lines.push("");
    lines.push("Gewijzigd t.o.v. vorige maand:");
    for (const f of delta.gewijzigd) lines.push(`  • ${f.label}${fmt(f.maandIndicatieCents)}`);
  }
  if (delta.verdwenen.length > 0) {
    lines.push("");
    lines.push("Niet meer van toepassing:");
    for (const f of delta.verdwenen) lines.push(`  • ${f.label}`);
  }
  const count = delta.nieuw.length + delta.gewijzigd.length + delta.verdwenen.length;
  return {
    subject: `DeGeldHeld Plus — ${count} update${count === 1 ? "" : "s"} in je maandscan`,
    text:
      `Hoi,\n\nJe maandelijkse Plus-scan vond ${count} item${count === 1 ? "" : "s"}:\n\n` +
      lines.join("\n") +
      `\n\nBekijk de details + dien aan in je dashboard.\n\n— DeGeldHeld`,
  };
}

/** Input voor één rescan-ronde. */
export type RescanUserInput = {
  userId: string;
  previousFindings: ReadonlyArray<RescanFinding>;
  currentFindings: ReadonlyArray<RescanFinding>;
};

/** Pure resultaat van runRescanForUser — caller doet IO (Prisma + mail). */
export type RescanResult = {
  userId: string;
  delta: RescanDelta;
  shouldNotify: boolean;
  /** Notificatie-mail klaar voor verzending — alleen aanwezig bij shouldNotify. */
  mail?: { subject: string; text: string };
};

export function runRescanForUser(input: RescanUserInput): RescanResult {
  const delta = diffFindings(input.previousFindings, input.currentFindings);
  if (isEmptyDelta(delta)) {
    return { userId: input.userId, delta, shouldNotify: false };
  }
  return {
    userId: input.userId,
    delta,
    shouldNotify: true,
    mail: formatRescanFindings(delta),
  };
}
