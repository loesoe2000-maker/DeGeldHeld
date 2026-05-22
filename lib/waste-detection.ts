/**
 * lib/waste-detection.ts — spookabonnement / verspilling-detectie.
 *
 * Pure functie over de bills die de gebruiker al heeft geüpload. Géén banking-
 * koppeling, géén opslag van extra data. We detecteren conservatief — eerder
 * niets melden dan onterecht "spook" roepen — en geven self-cancel-begeleiding
 * (de klant zegt ZELF op; we doen géén betaalde opzegdienst).
 *
 * Detectieregels (allebei conservatief):
 *  1. Categorie-overlap: ≥ 2 bills in dezelfde "subscription-class" categorie
 *     (STREAMING / SOFTWARE / OPSLAG / GYM). Vaak dubbele/onbenutte abos.
 *  2. Provider-duplicaat: zelfde canonieke provider 2× met hetzelfde
 *     maandbedrag → waarschijnlijk dubbel-opgevoerd of dubbel-afgeschreven.
 */

/** Subset van Bill — koppelt los aan Prisma. */
export type WasteBill = {
  id: string;
  provider: string;
  category: string; // BillCategory (string)
  monthlyCents: number | null;
  amountCents: number;
};

export type WasteFindingKind = "category-duplicate" | "provider-duplicate";

export type WasteFinding = {
  kind: WasteFindingKind;
  /** Stable id zodat de UI 'm kan dedupen / herrenderen. */
  id: string;
  /** Mens-leesbare titel. */
  title: string;
  /** Korte uitleg waarom dit een spook/verspilling-kandidaat kan zijn. */
  reason: string;
  /** Bill-ids betrokken bij deze finding. */
  billIds: string[];
  /** Som van de maandbedragen die hier mogelijk verspild worden. */
  monthlyTotalCents: number;
  /** Categorie-specifieke zelf-opzeg-begeleiding (NL). */
  cancelGuidance: string;
};

/** Subscription-class categorieën waarvoor overlap meestal verspilling is. */
const SUBSCRIPTION_CATEGORIES = new Set([
  "STREAMING",
  "SOFTWARE",
  "OPSLAG",
  "GYM",
]);

/**
 * Self-cancel-begeleiding per categorie. Bewust generic-veilig en zonder
 * provider-specifieke links (zou kunnen verouderen of fout zijn). Klanten
 * zeggen zelf op — DeGeldHeld vraagt nooit een opzeg-vergoeding.
 */
const CANCEL_GUIDANCE: Record<string, string> = {
  STREAMING:
    "Streamingdiensten kun je vrijwel altijd direct opzeggen via 'Account' of " +
    "'Abonnement' in hun app/website — meestal zonder opzegtermijn. Controleer " +
    "ook of een gezinslid/partner dezelfde dienst al heeft (family-plan).",
  SOFTWARE:
    "Software-abonnementen zeg je op in je account-instellingen of via de " +
    "support-pagina. Vraag óók om een refund voor de resterende periode als " +
    "je net hebt verlengd (14-dagen herroepingsrecht bij online aankoop).",
  OPSLAG:
    "Cloud-opslag (iCloud / Google One / Dropbox / OneDrive) zeg je op in de " +
    "abonnement-instellingen. Tip: download eerst je bestanden lokaal voordat " +
    "je downgrade — daarna kun je het lagere of gratis tier kiezen.",
  GYM:
    "Sportabonnementen: vraag schriftelijk een opzeg-bevestiging. ACM verplicht " +
    "providers tot een redelijke opzegtermijn (max. 1 maand na het 1e contractjaar). " +
    "Vraag of pauzeren een optie is als je een tijdje weg bent.",
  TELECOM:
    "Telecom-providers ondersteunen opzeggen via app/MijnX, chat of telefoon. Na " +
    "het 1e contractjaar geldt maandelijkse opzegtermijn. Een opzeg-mail naar " +
    "klantenservice volstaat ook (vraag om bevestiging).",
  ABONNEMENT:
    "Abonnementen op tijdschriften/lidmaatschappen kun je meestal opzeggen via je " +
    "account of klantenservice. Bij twijfel: schriftelijke opzeg vragen en " +
    "bevestiging laten sturen.",
};

const CATEGORY_LABEL: Record<string, string> = {
  STREAMING: "streamingdiensten",
  SOFTWARE: "software-abonnementen",
  OPSLAG: "cloud-opslag",
  GYM: "sportabonnementen",
  TELECOM: "telecom-/internet-abonnementen",
  ABONNEMENT: "abonnementen",
};

function effectiveMonthlyCents(b: WasteBill): number {
  return b.monthlyCents ?? b.amountCents ?? 0;
}

function genericGuidance(category: string): string {
  return (
    CANCEL_GUIDANCE[category] ??
    "Zeg op via je account/klantenservice en vraag schriftelijk om bevestiging. " +
      "Wij rekenen GEEN opzeg-fee — opzeggen kun je gratis zelf."
  );
}

/**
 * Detecteer spookabonnementen / verspilling. Pure, geen I/O. De volgorde:
 *  - provider-duplicates eerst (sterkste signaal — exact match);
 *  - dan category-overlap (zwakker — overlap kan terecht zijn);
 *  - geen findings → lege lijst (eerlijke "geen verspilling" UI-staat).
 */
export function detectWaste(bills: ReadonlyArray<WasteBill>): WasteFinding[] {
  const findings: WasteFinding[] = [];
  const usedBillIds = new Set<string>();

  // 1. Provider-duplicaten — zelfde canonical provider + zelfde maandbedrag.
  const byProvider = new Map<string, WasteBill[]>();
  for (const b of bills) {
    const key = b.provider.trim().toLowerCase();
    if (!key) continue;
    const arr = byProvider.get(key) ?? [];
    arr.push(b);
    byProvider.set(key, arr);
  }
  for (const [providerKey, group] of byProvider) {
    if (group.length < 2) continue;
    const sameAmount = new Map<number, WasteBill[]>();
    for (const b of group) {
      const m = effectiveMonthlyCents(b);
      if (m <= 0) continue;
      const arr = sameAmount.get(m) ?? [];
      arr.push(b);
      sameAmount.set(m, arr);
    }
    for (const [amount, dups] of sameAmount) {
      if (dups.length < 2) continue;
      const ids = dups.map((b) => b.id);
      ids.forEach((id) => usedBillIds.add(id));
      findings.push({
        kind: "provider-duplicate",
        id: `prov-dup:${providerKey}:${amount}`,
        title: `${dups[0].provider}: ${dups.length}× hetzelfde maandbedrag`,
        reason:
          "Twee of meer geüploade rekeningen bij dezelfde provider met hetzelfde " +
          "maandbedrag — dit duidt vaak op een dubbel abonnement of dubbele " +
          "afschrijving. Bekijk of één van de twee opgezegd kan worden.",
        billIds: ids,
        monthlyTotalCents: amount * (dups.length - 1), // wat je bespaart als je er één opzegt
        cancelGuidance: genericGuidance(dups[0].category),
      });
    }
  }

  // 2. Categorie-overlap — ≥ 2 bills in subscription-class categorie, exclude
  //    bills die al in provider-duplicate findings zitten.
  const byCategory = new Map<string, WasteBill[]>();
  for (const b of bills) {
    if (!SUBSCRIPTION_CATEGORIES.has(b.category)) continue;
    if (usedBillIds.has(b.id)) continue;
    const arr = byCategory.get(b.category) ?? [];
    arr.push(b);
    byCategory.set(b.category, arr);
  }
  for (const [cat, group] of byCategory) {
    if (group.length < 2) continue;
    const monthlyTotal = group.reduce((s, b) => s + effectiveMonthlyCents(b), 0);
    findings.push({
      kind: "category-duplicate",
      id: `cat-dup:${cat}`,
      title: `${group.length} ${CATEGORY_LABEL[cat] ?? "abonnementen"} actief`,
      reason:
        `Je hebt ${group.length} ${CATEGORY_LABEL[cat] ?? "abonnementen"} ` +
        "tegelijk. Vaak betaalt iemand voor één die hij/zij nauwelijks gebruikt " +
        "— check welke je het laatst opende of overlapt met een familielid.",
      billIds: group.map((b) => b.id),
      monthlyTotalCents: monthlyTotal,
      cancelGuidance: genericGuidance(cat),
    });
  }

  // Stabiele volgorde voor UI/tests: provider-duplicates eerst, daarna
  // category-duplicates op categorie-naam.
  findings.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "provider-duplicate" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return findings;
}

/** Som van het mogelijk-bespaarbare maandbedrag over alle findings. */
export function totalPotentialMonthlyCents(findings: ReadonlyArray<WasteFinding>): number {
  return findings.reduce((s, f) => s + f.monthlyTotalCents, 0);
}

/** Voor de UI/tests: ook in deze module exposed zodat tests inhoud kunnen locken. */
export { CANCEL_GUIDANCE, CATEGORY_LABEL, SUBSCRIPTION_CATEGORIES };
