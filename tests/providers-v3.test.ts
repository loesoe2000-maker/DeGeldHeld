import { describe, it, expect } from "vitest";
import {
  NL_PROVIDERS,
  findProvider,
  listProvidersByCategory,
  listProvidersByRegion,
  totalProviderCount,
  allCategories,
} from "../lib/providers";
import { MARKET_PLANS, uniqueProviders, totalPlanCount } from "../lib/market_db";

describe("providers-v3/expansion", () => {
  it("totalProviderCount >= 150", () => {
    expect(totalProviderCount()).toBeGreaterThanOrEqual(150);
  });

  it("MARKET_PLANS contains 150+ plans", () => {
    expect(totalPlanCount()).toBeGreaterThanOrEqual(150);
  });

  it("uniqueProviders count matches NL_PROVIDERS or close", () => {
    expect(uniqueProviders().length).toBeGreaterThanOrEqual(130);
  });

  it("includes BANK as a category", () => {
    expect(allCategories()).toContain("BANK");
  });
});

describe("providers-v3/regions", () => {
  it("has NL region providers", () => {
    expect(listProvidersByRegion("NL").length).toBeGreaterThanOrEqual(80);
  });

  it("has EU region providers", () => {
    expect(listProvidersByRegion("EU").length).toBeGreaterThanOrEqual(20);
  });

  it("has GLOBAL region providers", () => {
    expect(listProvidersByRegion("GLOBAL").length).toBeGreaterThanOrEqual(10);
  });
});

describe("providers-v3/telecom NL", () => {
  it("includes Youfone", () => {
    expect(findProvider("Youfone")?.canonical).toBe("Youfone");
  });

  it("includes Ben", () => {
    expect(findProvider("Ben Mobiel")?.canonical).toBe("Ben");
  });

  it("includes Hollandsnieuwe", () => {
    expect(findProvider("hollandsnieuwe")?.canonical).toBe("Hollandsnieuwe");
  });

  it("includes Simpel via simpel.nl alias", () => {
    expect(findProvider("simpel.nl factuur")?.canonical).toBe("Simpel");
  });

  it("includes Lebara, Lyca, Simyo", () => {
    expect(findProvider("Lebara")?.canonical).toBe("Lebara");
    expect(findProvider("Lyca Mobile")?.canonical).toBe("Lyca Mobile");
    expect(findProvider("Simyo")?.canonical).toBe("Simyo");
  });
});

describe("providers-v3/energie NL", () => {
  it("includes Pure Energie", () => {
    expect(findProvider("Pure Energie")?.canonical).toBe("Pure Energie");
  });

  it("includes Frank Energie", () => {
    expect(findProvider("Frank Energie")?.canonical).toBe("Frank Energie");
  });

  it("includes EasyEnergy and Oxxio", () => {
    expect(findProvider("EasyEnergy")?.canonical).toBe("EasyEnergy");
    expect(findProvider("Oxxio")?.canonical).toBe("Oxxio");
  });
});

describe("providers-v3/verzekering", () => {
  it("includes Univé", () => {
    expect(findProvider("Univé")?.canonical).toBe("Univé");
  });

  it("includes ASR via a.s.r. alias", () => {
    expect(findProvider("a.s.r.")?.canonical).toBe("ASR");
  });

  it("includes 7 zorg providers", () => {
    const zorg = ["Zilveren Kruis", "VGZ", "CZ", "Menzis", "DSW", "ONVZ", "Salland"];
    for (const z of zorg) {
      expect(findProvider(z)?.canonical).toBe(z);
    }
  });

  it("includes Allianz", () => {
    expect(findProvider("Allianz")?.canonical).toBe("Allianz");
  });
});

describe("providers-v3/bank", () => {
  it("ABN AMRO is BANK category", () => {
    expect(findProvider("ABN AMRO")?.category).toBe("BANK");
  });

  it("Bunq is BANK", () => {
    expect(findProvider("Bunq")?.category).toBe("BANK");
  });

  it("Knab, SNS, ASN, Triodos are all BANK", () => {
    for (const b of ["Knab", "SNS", "ASN Bank", "Triodos"]) {
      expect(findProvider(b)?.category).toBe("BANK");
    }
  });

  it("INT banks: Revolut and N26 are global (v5 reclassified from EU)", () => {
    expect(findProvider("Revolut")?.region).toBe("GLOBAL");
    expect(findProvider("N26")?.region).toBe("GLOBAL");
  });
});

describe("providers-v3/hypotheek disambiguation", () => {
  it("ABN AMRO Hypotheken matches longest alias (HYPOTHEEK over BANK)", () => {
    const r = findProvider("ABN AMRO Hypotheken");
    expect(r?.canonical).toBe("ABN AMRO Hypotheken");
    expect(r?.category).toBe("HYPOTHEEK");
  });

  it("Florius/Munt/Argenta in HYPOTHEEK", () => {
    for (const h of ["Florius", "Munt Hypotheken", "Argenta", "Obvion", "BLG Wonen"]) {
      expect(findProvider(h)?.category).toBe("HYPOTHEEK");
    }
  });
});

describe("providers-v3/abonnement streaming", () => {
  it("finds Netflix, Disney+, HBO Max (v5 reclassified ABONNEMENT → STREAMING)", () => {
    expect(findProvider("Netflix")?.category).toBe("STREAMING");
    expect(findProvider("Disney+")?.category).toBe("STREAMING");
    expect(findProvider("HBO Max")?.category).toBe("STREAMING");
  });

  it("finds Apple TV+, Prime, Videoland, Spotify", () => {
    expect(findProvider("Apple TV+")?.canonical).toBe("Apple TV+");
    expect(findProvider("Amazon Prime")?.canonical).toBe("Amazon Prime Video");
    expect(findProvider("Videoland")?.canonical).toBe("Videoland");
    expect(findProvider("Spotify")?.canonical).toBe("Spotify");
  });

  it("finds Basic-Fit and SportCity (sport)", () => {
    expect(findProvider("Basic-Fit")?.canonical).toBe("Basic-Fit");
    expect(findProvider("basicfit")?.canonical).toBe("Basic-Fit");
    expect(findProvider("SportCity")?.canonical).toBe("SportCity");
  });

  it("finds software: Microsoft 365, Adobe, Dropbox, ChatGPT Plus", () => {
    expect(findProvider("Microsoft 365")?.canonical).toBe("Microsoft 365");
    expect(findProvider("office 365")?.canonical).toBe("Microsoft 365");
    expect(findProvider("Adobe Creative Cloud")?.canonical).toBe("Adobe Creative Cloud");
    expect(findProvider("Dropbox Plus")?.canonical).toBe("Dropbox");
    expect(findProvider("ChatGPT Plus")?.canonical).toBe("ChatGPT Plus");
  });
});

describe("providers-v3/EU telecom", () => {
  it("finds Orange, Deutsche Telekom, O2, Three, EE", () => {
    for (const t of ["Orange", "Deutsche Telekom", "O2", "Three", "EE"]) {
      const r = findProvider(t);
      expect(r).not.toBeNull();
      expect(r?.region === "EU" || r?.region === "GLOBAL").toBe(true);
    }
  });

  it("finds Bouygues, SFR, Free Mobile (FR)", () => {
    expect(findProvider("Bouygues Telecom")?.canonical).toBe("Bouygues Telecom");
    expect(findProvider("SFR")?.canonical).toBe("SFR");
    expect(findProvider("Free Mobile")?.canonical).toBe("Free Mobile");
  });
});

describe("providers-v3/EU energie", () => {
  it("finds E.ON, RWE, EDF, Enel", () => {
    expect(findProvider("E.ON")?.canonical).toBe("E.ON");
    expect(findProvider("RWE")?.canonical).toBe("RWE");
    expect(findProvider("EDF")?.canonical).toBe("EDF");
    expect(findProvider("Enel")?.canonical).toBe("Enel");
  });

  it("finds Iberdrola, TotalEnergies, Octopus", () => {
    expect(findProvider("Iberdrola")?.canonical).toBe("Iberdrola");
    expect(findProvider("TotalEnergies")?.canonical).toBe("TotalEnergies");
    expect(findProvider("Octopus Energy")?.canonical).toBe("Octopus Energy");
  });
});

describe("providers-v3/integrity", () => {
  it("all canonical names unique", () => {
    const names = NL_PROVIDERS.map((p) => p.canonical.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("each provider has region set", () => {
    for (const p of NL_PROVIDERS) {
      expect(["NL", "EU", "GLOBAL"]).toContain(p.region);
    }
  });

  it("each provider has at least 1 alias", () => {
    for (const p of NL_PROVIDERS) {
      expect(p.aliases.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("listProvidersByCategory returns BANK list", () => {
    const banks = listProvidersByCategory("BANK");
    expect(banks.length).toBeGreaterThanOrEqual(8);
  });

  it("MARKET_PLANS providers all exist in NL_PROVIDERS", () => {
    const canonicalSet = new Set(NL_PROVIDERS.map((p) => p.canonical.toLowerCase()));
    for (const plan of MARKET_PLANS) {
      expect(canonicalSet.has(plan.provider.toLowerCase())).toBe(true);
    }
  });

  it("aliases use lowercase by convention", () => {
    for (const p of NL_PROVIDERS) {
      for (const a of p.aliases) {
        expect(a).toBe(a.toLowerCase());
      }
    }
  });
});
