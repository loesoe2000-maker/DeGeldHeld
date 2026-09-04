import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HuurprijsCheckClient from "@/app/huurprijs-check/HuurprijsCheckClient";

/**
 * v40 F3 — de intake mag nooit optimistischer zijn dan lib/huurprijs-check.
 * Deze suite borgt de eerlijkheids-gedragingen in de UI zelf.
 */

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ track }));

beforeEach(() => track.mockClear());

/** Vult het formulier met een woning van ~159 punten (gekalibreerde case 1). */
function vulFormulier(opts: { huur: string; start: string; label?: string }) {
  const m2 = ["18", "10", "12", "6"]; // woonkamer, keuken, slaapkamer, badkamer
  m2.forEach((v, i) => {
    fireEvent.change(screen.getByTestId(`hp-ruimte-m2-${i}`), { target: { value: v } });
  });
  fireEvent.change(screen.getByTestId("hp-woz"), { target: { value: "300000" } });
  fireEvent.change(screen.getByTestId("hp-label"), { target: { value: opts.label ?? "A" } });
  fireEvent.change(screen.getByTestId("hp-aanrecht"), { target: { value: "180" } });
  fireEvent.change(screen.getByTestId("hp-buiten"), { target: { value: "6" } });
  fireEvent.change(screen.getByTestId("hp-startdatum"), { target: { value: opts.start } });
  fireEvent.change(screen.getByTestId("hp-huur"), { target: { value: opts.huur } });
}

describe("HuurprijsCheckClient — validatie", () => {
  it("vraagt om de huurprijs voordat er iets gerekend wordt", () => {
    render(<HuurprijsCheckClient />);
    fireEvent.click(screen.getByTestId("hp-submit"));
    expect(screen.getByTestId("hp-fout").textContent).toMatch(/kale maandhuur/i);
    expect(screen.queryByTestId("hp-resultaat")).toBeNull();
  });

  it("vraagt om de contractdatum — die bepaalt of er een route is", () => {
    render(<HuurprijsCheckClient />);
    fireEvent.change(screen.getByTestId("hp-huur"), { target: { value: "1200" } });
    fireEvent.change(screen.getByTestId("hp-woz"), { target: { value: "300000" } });
    fireEvent.click(screen.getByTestId("hp-submit"));
    expect(screen.getByTestId("hp-fout").textContent).toMatch(/ingangsdatum/i);
  });
});

describe("HuurprijsCheckClient — woningdelers-gate (BHW art. 1 lid 2)", () => {
  const recent = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  };

  it("3 bewoners zonder gezamenlijke huishouding → ander stelsel, GEEN punten getoond", () => {
    render(<HuurprijsCheckClient />);
    fireEvent.change(screen.getByTestId("hp-bewoners"), { target: { value: "3" } });
    vulFormulier({ huur: "1.500,00", start: recent() });
    fireEvent.click(screen.getByTestId("hp-submit"));

    expect(screen.getByTestId("hp-onzelfstandig")).toBeInTheDocument();
    // Het puntenaantal mag NIET verschijnen — het is met het verkeerde stelsel gerekend.
    expect(screen.queryByTestId("hp-punten")).toBeNull();
    expect(screen.queryByTestId("hp-maxhuur")).toBeNull();
    expect(screen.queryByTestId("hp-brief")).toBeNull();
    // Wel een eerlijke doorverwijzing.
    expect(screen.getByTestId("hp-route").textContent).toMatch(/gereguleerde sector/i);
  });

  it("gezin van 4 mét gezamenlijke huishouding → gewoon doorrekenen", () => {
    render(<HuurprijsCheckClient />);
    fireEvent.change(screen.getByTestId("hp-bewoners"), { target: { value: "4" } });
    fireEvent.click(screen.getByTestId("hp-huishouding"));
    vulFormulier({ huur: "1.500,00", start: recent() });
    fireEvent.click(screen.getByTestId("hp-submit"));

    expect(screen.queryByTestId("hp-onzelfstandig")).toBeNull();
    expect(screen.getByTestId("hp-punten").textContent).toBe("146");
  });

  it("de huishouding-vraag verschijnt pas vanaf 3 bewoners", () => {
    render(<HuurprijsCheckClient />);
    expect(screen.queryByTestId("hp-huishouding")).toBeNull();
    fireEvent.change(screen.getByTestId("hp-bewoners"), { target: { value: "3" } });
    expect(screen.getByTestId("hp-huishouding")).toBeInTheDocument();
  });
});

describe("HuurprijsCheckClient — uitkomsten", () => {
  it("te hoge huur bij een recent contract → resultaat met punten en route", () => {
    render(<HuurprijsCheckClient />);
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    vulFormulier({ huur: "1.500,00", start: recent.toISOString().slice(0, 10) });
    fireEvent.click(screen.getByTestId("hp-submit"));

    expect(screen.getByTestId("hp-resultaat")).toBeInTheDocument();
    // 46 m² vertrekken + 8 verwarming + 37 energie(A) + 4 keuken + 5 sanitair
    // + 4 buiten + 42 WOZ = 146 punten → officiële tabelrij € 953,45.
    expect(screen.getByTestId("hp-punten").textContent).toBe("146");
    expect(screen.getByTestId("hp-maxhuur").textContent).toMatch(/953/);
    expect(screen.getByTestId("hp-route").textContent).toMatch(/aanvangshuurprijs/i);
  });

  it("oud contract met 159 punten → eerlijk 'geen procedure mogelijk', geen brief", () => {
    render(<HuurprijsCheckClient />);
    vulFormulier({ huur: "1.500,00", start: "2020-01-01" });
    fireEvent.click(screen.getByTestId("hp-submit"));

    expect(screen.getByTestId("hp-route").textContent).toMatch(/geen procedure mogelijk/i);
    // Geen route = geen DIY-brief die valse hoop geeft.
    expect(screen.queryByTestId("hp-brief")).toBeNull();
  });

  it("zonder energielabel verschijnt de EP-Online-waarschuwing", () => {
    render(<HuurprijsCheckClient />);
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    vulFormulier({ huur: "1.500,00", start: recent.toISOString().slice(0, 10), label: "" });
    fireEvent.change(screen.getByTestId("hp-bouwjaar"), { target: { value: "1994" } });
    fireEvent.click(screen.getByTestId("hp-submit"));

    expect(screen.getByTestId("hp-waarschuwingen").textContent).toMatch(/EP-Online/);
  });

  it("analytics krijgt alleen verdict/punten/route — geen huur, WOZ of adres", () => {
    render(<HuurprijsCheckClient />);
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    vulFormulier({ huur: "1.500,00", start: recent.toISOString().slice(0, 10) });
    fireEvent.click(screen.getByTestId("hp-submit"));

    expect(track).toHaveBeenCalledWith("huurprijs_check_done", expect.anything());
    const payload = track.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["punten", "route", "verdict"]);
  });

  it("extra's niet nagelopen → ruimere (pessimistischere) doorrekening", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    const start = recent.toISOString().slice(0, 10);
    const ruimePunten = (tekst: string): number =>
      Number(/op (\d+) punten/.exec(tekst)?.[1] ?? "0");

    const { unmount } = render(<HuurprijsCheckClient />);
    vulFormulier({ huur: "1.100,00", start });
    fireEvent.click(screen.getByTestId("hp-submit"));
    const zonderVinkje = ruimePunten(screen.getByTestId("hp-resultaat").textContent ?? "");
    unmount();

    render(<HuurprijsCheckClient />);
    vulFormulier({ huur: "1.100,00", start });
    fireEvent.click(screen.getByTestId("hp-extras-ingevuld"));
    fireEvent.click(screen.getByTestId("hp-submit"));
    const metVinkje = ruimePunten(screen.getByTestId("hp-resultaat").textContent ?? "");

    // Niet nagelopen → luxe op het wettelijke maximum → hogere toegestane huur
    // → strenger oordeel. Aanvinken maakt de check minder pessimistisch.
    expect(zonderVinkje).toBeGreaterThan(metVinkje);
    expect(metVinkje).toBeGreaterThan(0);
  });
});
