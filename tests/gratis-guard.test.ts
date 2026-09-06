import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { feeForVerifiedSavings, shouldChargeVerifiedFee } from "@/lib/payments";
import { computeBox3Fee } from "@/lib/box3-claim";
import { computeHuurFee, HUURCOMMISSIE_LEGES_CENTS } from "@/lib/huurcommissie";
import {
  computeEnergieFee,
  ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS,
  ENERGIE_KLACHTGELD_VERGOEDING_CENTS,
} from "@/lib/energie-claim";
import { EN_FEE_NOTE } from "@/lib/i18n-en";

/**
 * v41 — DE POORTWACHTER van het gratis platform.
 *
 * Twee soorten borging, en ze zijn allebei nodig:
 *  1. GEEN FEE-COPY — geen enkele publieke tekst belooft of noemt nog een
 *     eigen fee. Zonder deze test sluipt "20% no cure no pay" er bij de
 *     eerste de beste nieuwe pagina weer in.
 *  2. GEEN INCASSO-PAD — de rekenfuncties geven 0 en er is geen route die
 *     een Stripe-sessie start.
 *
 * En één omgekeerde borging die net zo belangrijk is:
 *  3. DE LEGES BLIJVEN — kosten die de klant aan een DERDE betaalt moeten
 *     zichtbaar blijven. Weglaten maakt "gratis" misleidend.
 */

const WORTEL = path.join(__dirname, "..");

/** Bestanden met publieke tekst. API-routes en tests vallen erbuiten. */
function copyBestanden(): string[] {
  const uit: string[] = [];
  const loop = (dir: string) => {
    for (const naam of readdirSync(dir)) {
      const p = path.join(dir, naam);
      if (statSync(p).isDirectory()) {
        if (naam === "node_modules" || naam === ".next") continue;
        loop(p);
      } else if (naam.endsWith(".tsx")) {
        uit.push(p);
      }
    }
  };
  loop(path.join(WORTEL, "app"));
  loop(path.join(WORTEL, "components"));
  uit.push(path.join(WORTEL, "lib/i18n-en.ts"));
  uit.push(path.join(WORTEL, "lib/moneyfinder-hub.ts"));
  uit.push(path.join(WORTEL, "lib/email_templates.ts"));
  return uit;
}

/**
 * Uitzonderingen: hier gaat het aantoonbaar over ANDERMANS fee (externe
 * claimbureaus bij vluchtclaims). Die informatie is juist eerlijk en moet
 * blijven staan — mits er "niet DeGeldHeld" of "extern" bij staat.
 */
const EXTERNE_PARTIJ = [
  "vlucht-vertraagd-vergoeding-eu261",
  "voorwaarden",
  "vluchtclaim",
];

const FEE_PATRONEN: Array<{ naam: string; re: RegExp }> = [
  { naam: "no cure no pay", re: /no[-\s]?cure[,\s-]*no[-\s]?pay/i },
  { naam: "onze fee", re: /onze\s+fee|our\s+fee/i },
  { naam: "NCNP", re: /\bNCNP\b/ },
  // Let op: dit patroon mag NIET matchen op percentages die de klant
  // TERUGKRIJGT (NS vergoedt 25% van de ticketprijs, EU-PRR 50%). Daarom
  // eist het expliciet een fee-woord ernaast.
  { naam: "fee-percentage", re: /\b(20|25)\s?%\s*(?:fee|NCNP)|(?:onze|our)\s+(?:fee|vergoeding)\s*(?:is|van)?\s*\b(20|25)\s?%|wij rekenen\s+\d+\s?%/i },
  { naam: "Plus-abonnement", re: /Plus[-\s]abonnement|€\s?4,99|€\s?9,99/i },
  { naam: "paywall", re: /paywall/i },
];

describe("v41 — geen fee-copy in publieke teksten", () => {
  const bestanden = copyBestanden();

  it("scant een substantieel aantal bestanden (anders is de test zinloos)", () => {
    expect(bestanden.length).toBeGreaterThan(50);
  });

  for (const { naam, re } of FEE_PATRONEN) {
    it(`nergens "${naam}"`, () => {
      const treffers: string[] = [];
      for (const bestand of bestanden) {
        const rel = path.relative(WORTEL, bestand);
        if (EXTERNE_PARTIJ.some((e) => rel.includes(e))) continue;
        const inhoud = readFileSync(bestand, "utf8");
        inhoud.split("\n").forEach((regel, i) => {
          if (re.test(regel)) treffers.push(`${rel}:${i + 1} → ${regel.trim().slice(0, 90)}`);
        });
      }
      expect(treffers, `Fee-copy teruggeslopen:\n${treffers.join("\n")}`).toEqual([]);
    });
  }
});

describe("v41 — geen incasso-pad", () => {
  it("elke fee-berekening geeft 0, ongeacht het bedrag", () => {
    for (const cents of [1, 5_000, 50_000, 1_000_000]) {
      expect(feeForVerifiedSavings(cents)).toBe(0);
      expect(computeBox3Fee(cents)).toBe(0);
      expect(computeHuurFee(cents)).toBe(0);
      expect(computeEnergieFee(cents)).toBe(0);
    }
  });

  it("shouldChargeVerifiedFee is false, ook met de oude env-vlag aan", async () => {
    const oud = process.env.FEATURE_NO_CURE_NO_PAY;
    process.env.FEATURE_NO_CURE_NO_PAY = "true";
    try {
      await expect(
        shouldChargeVerifiedFee({ userId: "u", actualSavingsCents: 999_999 }),
      ).resolves.toBe(false);
    } finally {
      if (oud === undefined) delete process.env.FEATURE_NO_CURE_NO_PAY;
      else process.env.FEATURE_NO_CURE_NO_PAY = oud;
    }
  });

  it("geen enkele pagina of component start nog een Stripe-sessie", () => {
    const verboden = /createCheckoutSession|createPaywallCheckoutSession|createFeeSetupSession|chargeFeeOffSession/;
    const treffers: string[] = [];
    for (const bestand of copyBestanden()) {
      if (verboden.test(readFileSync(bestand, "utf8"))) {
        treffers.push(path.relative(WORTEL, bestand));
      }
    }
    expect(treffers).toEqual([]);
  });
});

describe("v41 — de leges van DERDEN blijven zichtbaar", () => {
  it("de drie bedragen staan nog in de libs", () => {
    expect(HUURCOMMISSIE_LEGES_CENTS).toBe(2_500); // € 25 Huurcommissie
    expect(ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS).toBe(2_750); // € 27,50
    expect(ENERGIE_KLACHTGELD_VERGOEDING_CENTS).toBe(5_250); // € 52,50
  });

  it("de Engelse kostennoot noemt ze én zegt dat ze niet naar ons gaan", () => {
    expect(EN_FEE_NOTE).toMatch(/€\s?25/);
    expect(EN_FEE_NOTE).toMatch(/€\s?27\.50/);
    expect(EN_FEE_NOTE).toMatch(/€\s?52\.50/);
    expect(EN_FEE_NOTE).toMatch(/not to us/i);
  });

  it("de voorwaarden benoemen de kosten van derden expliciet", () => {
    const v = readFileSync(path.join(WORTEL, "app/voorwaarden/page.tsx"), "utf8");
    expect(v).toMatch(/Kosten/);
    expect(v).toMatch(/€ 25/);
    expect(v).toMatch(/Huurcommissie/);
  });

  it("de aansprakelijkheid is NIET beperkt tot 'het betaalde bedrag' (bij gratis = nul)", () => {
    const v = readFileSync(path.join(WORTEL, "app/voorwaarden/page.tsx"), "utf8");
    expect(v).not.toMatch(/beperkt tot het door jou betaalde bedrag/);
    expect(v).toMatch(/€ 500 per gebeurtenis/);
  });
});

/**
 * v41 — DE POORT, NIET DE REKENSOM.
 *
 * De eerste versie van deze guard sloeg `app/api/**` over, precies de map waar
 * de echte Stripe-aanroepen stonden. De suite was groen terwijl /api/checkout
 * en /api/fee-setup nog live betaalsessies aanmaakten. Copy controleren zegt
 * niets als de betaalpoort openstaat; daarom scant dit blok de routes zelf.
 */
describe("v41 — geen enkele route kan nog een betaling starten", () => {
  const VERBODEN = [
    "createCheckoutSession",
    "createPaywallCheckoutSession",
    "createFeeSetupSession",
    "chargeFeeOffSession",
  ];

  function routes(dir: string, out: string[] = []): string[] {
    for (const naam of readdirSync(dir)) {
      const p = path.join(dir, naam);
      if (statSync(p).isDirectory()) {
        if (naam === "node_modules" || naam === ".next") continue;
        routes(p, out);
      } else if (naam === "route.ts" || naam === "route.tsx") {
        out.push(p);
      }
    }
    return out;
  }

  const apiRoutes = routes(path.join(__dirname, "..", "app", "api"));

  it("vindt überhaupt API-routes (anders is deze test zinloos groen)", () => {
    expect(apiRoutes.length).toBeGreaterThan(20);
  });

  it.each(VERBODEN)("geen route roept %s aan", (fn) => {
    const daders = apiRoutes.filter((p) => {
      const src = readFileSync(p, "utf8");
      // Alleen echte aanroepen/imports tellen — niet het woord in commentaar.
      return new RegExp(`(?<!//.*)\\b${fn}\\s*[({]|import[^;]*\\b${fn}\\b`, "m").test(
        src.replace(/^\s*\*.*$/gm, "").replace(/\/\/.*$/gm, ""),
      );
    });
    expect(daders.map((p) => p.split("/app/")[1])).toEqual([]);
  });

  it("de opgeheven betaalroutes antwoorden 410, en bestaan dus nog bewust", () => {
    for (const r of ["checkout/route.ts", "fee-setup/route.ts"]) {
      const src = readFileSync(path.join(__dirname, "..", "app", "api", r), "utf8");
      expect(src).toMatch(/status: 410/);
    }
  });

  it("het mandaat kan nog wél ingetrokken worden (DELETE blijft bestaan)", () => {
    const src = readFileSync(path.join(__dirname, "..", "app", "api", "fee-setup", "route.ts"), "utf8");
    expect(src).toMatch(/export async function DELETE/);
    expect(src).toMatch(/detachFeePaymentMethod/);
  });
});

/**
 * v41 — DE VOLLEDIGE AANROEPKAART.
 *
 * Het api-blok hierboven dekt de routes. Maar `chargeFeeOffSession` wordt ook
 * vanuit `lib/` aangeroepen, en dat viel buiten beeld. Deze test legt de
 * VOLLEDIGE verzameling aanroepers vast: elke nieuwe plek die een
 * betaalfunctie aanraakt laat deze test omvallen, waar hij ook staat.
 *
 * Voor de toegestane plekken geldt bovendien een harde nul-poort: de aanroep
 * moet achter `feeCents > 0` zitten. Alle fee-berekeningen geven 0 terug, dus
 * de aanroep is onbereikbaar — en blijft dat ook als iemand een berekening
 * later per ongeluk terugzet.
 */
describe("v41 — alle aanroepers van een betaalfunctie liggen vast", () => {
  const BETAALFUNCTIES = /createCheckoutSession|createPaywallCheckoutSession|createFeeSetupSession|chargeFeeOffSession/;

  // Definitie zelf + het dev-script (dat al hard weigert op sk_live_) + de
  // plek die achter de nul-poort zit. Meer mag het niet worden.
  const TOEGESTAAN = new Set([
    "lib/payments.ts", // hier staan de definities
    "lib/outcome-proof.ts", // achter `feeCents > 0` — zie nul-poort-test
    "scripts/test-stripe-flow.ts", // weigert bij sk_live_, alleen sk_test_
  ]);

  function bronnen(dir: string, out: string[] = []): string[] {
    for (const naam of readdirSync(dir)) {
      const volledig = path.join(dir, naam);
      if (statSync(volledig).isDirectory()) {
        if (["node_modules", ".next", "tests", ".git"].includes(naam)) continue;
        bronnen(volledig, out);
      } else if (/\.tsx?$/.test(naam)) {
        out.push(volledig);
      }
    }
    return out;
  }

  const wortel = path.join(__dirname, "..");

  it("geen enkele onverwachte plek raakt een betaalfunctie aan", () => {
    const rakers = bronnen(wortel)
      .filter((f) => {
        const src = readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        return BETAALFUNCTIES.test(src);
      })
      .map((f) => f.slice(wortel.length + 1))
      .filter((f) => !TOEGESTAAN.has(f));
    expect(rakers).toEqual([]);
  });

  it("de nul-poort staat vóór elke incasso-aanroep", () => {
    for (const f of ["lib/outcome-proof.ts", "lib/box3-claim.ts"]) {
      expect(readFileSync(path.join(wortel, f), "utf8")).toMatch(/feeCents\s*[<>]=?\s*0/);
    }
  });

  it("het dev-script weigert een LIVE-sleutel", () => {
    const src = readFileSync(path.join(wortel, "scripts/test-stripe-flow.ts"), "utf8");
    expect(src).toMatch(/sk_live_/);
    expect(src).toMatch(/process\.exit\(3\)/);
  });
});

