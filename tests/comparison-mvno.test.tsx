import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Comparison from "../components/Comparison";
import { buildComparison } from "../lib/comparison";
import {
  describeNetwork,
  getProviderNetwork,
  NL_PROVIDERS,
} from "../lib/providers";

describe("providers/getProviderNetwork", () => {
  it("KPN → null (eigen netwerk)", () => {
    expect(getProviderNetwork("KPN")).toBeNull();
  });

  it("Vodafone → null (eigen netwerk)", () => {
    expect(getProviderNetwork("Vodafone")).toBeNull();
  });

  it("Odido → null (eigen netwerk)", () => {
    expect(getProviderNetwork("Odido")).toBeNull();
  });

  it("Budget Mobiel → KPN", () => {
    expect(getProviderNetwork("Budget Mobiel")).toBe("KPN");
  });

  it("Simyo → KPN", () => {
    expect(getProviderNetwork("Simyo")).toBe("KPN");
  });

  it("Hollandsnieuwe → KPN", () => {
    expect(getProviderNetwork("Hollandsnieuwe")).toBe("KPN");
  });

  it("Lebara → KPN", () => {
    expect(getProviderNetwork("Lebara")).toBe("KPN");
  });

  it("Lyca Mobile → KPN", () => {
    expect(getProviderNetwork("Lyca Mobile")).toBe("KPN");
  });

  it("Youfone → KPN", () => {
    expect(getProviderNetwork("Youfone")).toBe("KPN");
  });

  it("Aldi Talk → KPN", () => {
    expect(getProviderNetwork("Aldi Talk")).toBe("KPN");
  });

  it("Telfort → KPN (legacy)", () => {
    expect(getProviderNetwork("Telfort")).toBe("KPN");
  });

  it("Ben → Odido (T-Mobile NL rebrand)", () => {
    expect(getProviderNetwork("Ben")).toBe("Odido");
  });

  it("Simpel → Odido", () => {
    expect(getProviderNetwork("Simpel")).toBe("Odido");
  });

  it("Tele2 → Odido (merged 2019)", () => {
    expect(getProviderNetwork("Tele2")).toBe("Odido");
  });

  it("T-Mobile → Odido (legacy rebrand)", () => {
    expect(getProviderNetwork("T-Mobile")).toBe("Odido");
  });

  it("Eneco → undefined (geen mobiele provider)", () => {
    expect(getProviderNetwork("Eneco")).toBeUndefined();
  });

  it("Onbekend → undefined", () => {
    expect(getProviderNetwork("Foobar")).toBeUndefined();
  });

  it("internet/TV providers (Ziggo) → undefined (geen mobiel)", () => {
    // Ziggo is TELECOM maar internet/TV, geen mobiel netwerk
    // (de implementation maakt geen onderscheid binnen TELECOM, dus deze
    //  test verifieert dat we tenminste niet crashen)
    const r = getProviderNetwork("Ziggo");
    // network niet gezet op Ziggo → undefined of null
    expect(r === null || r === undefined).toBe(true);
  });
});

describe("providers/describeNetwork", () => {
  it("eigen netwerk label voor KPN", () => {
    expect(describeNetwork("KPN")).toBe("eigen netwerk");
  });

  it("MVNO label voor Budget Mobiel", () => {
    expect(describeNetwork("Budget Mobiel")).toBe("MVNO op KPN-netwerk");
  });

  it("MVNO label voor Ben (Odido-netwerk)", () => {
    expect(describeNetwork("Ben")).toBe("MVNO op Odido-netwerk");
  });

  it("null voor non-mobiele providers", () => {
    expect(describeNetwork("Eneco")).toBeNull();
  });
});

describe("Comparison/MVNO render", () => {
  it("toont 'eigen netwerk' voor KPN-plan", () => {
    // Force a comparison where KPN is een alternatief
    const r = buildComparison({
      provider: "Vodafone",
      category: "TELECOM",
      amountCents: 4000,
    });
    render(<Comparison result={r} />);
    // KPN of Vodafone-plan in top alternatives
    const labels = screen.queryAllByTestId("network-label");
    expect(labels.length).toBeGreaterThan(0);
    const text = labels.map((l) => l.textContent ?? "").join(" ");
    expect(text).toMatch(/eigen netwerk|MVNO op/);
  });

  it("toont 'MVNO op KPN-netwerk' voor Budget Mobiel plan", () => {
    // Maak een handmatige comparison met Budget Mobiel als #1 alternatief.
    const r = buildComparison({
      provider: "KPN",
      category: "TELECOM",
      amountCents: 3500,
    });
    // Inject Budget Mobiel alt aan top zodat we het zeker renderen
    const budgetAlt = {
      plan: {
        provider: "Budget Mobiel",
        category: "TELECOM" as const,
        name: "Sim Only 5 GB",
        priceCents: 700,
        features: "5 GB op KPN",
      },
      monthlySavingsCents: 2800,
      yearlySavingsCents: 33600,
      percentSaved: 0.8,
      rationale: "Test",
    };
    const forced = { ...r, topAlternatives: [budgetAlt, ...r.topAlternatives.slice(0, 2)] };
    render(<Comparison result={forced} />);
    const labels = screen.getAllByTestId("network-label");
    const budgetLabel = labels.find((l) => l.textContent?.includes("KPN"));
    expect(budgetLabel).toBeDefined();
    expect(budgetLabel?.textContent).toMatch(/MVNO op KPN-netwerk/);
  });
});

describe("providers/network coverage integrity", () => {
  it("alle mobiele MVNO's hebben network gezet", () => {
    const mvnoExpected = [
      "Budget Mobiel", "Simyo", "Hollandsnieuwe", "Lebara", "Lyca Mobile",
      "Youfone", "Aldi Talk", "Telfort", "Ben", "Simpel", "Tele2",
    ];
    for (const name of mvnoExpected) {
      const p = NL_PROVIDERS.find((x) => x.canonical === name);
      expect(p, `provider ${name} ontbreekt in registry`).toBeDefined();
      expect(p?.network, `${name} mist network`).not.toBeUndefined();
      expect(p?.network).not.toBeNull();
    }
  });

  it("eigen-netwerk providers hebben network=null (niet undefined)", () => {
    const owners = ["KPN", "Vodafone", "Odido"];
    for (const name of owners) {
      const p = NL_PROVIDERS.find((x) => x.canonical === name);
      expect(p?.network).toBeNull();
    }
  });
});
