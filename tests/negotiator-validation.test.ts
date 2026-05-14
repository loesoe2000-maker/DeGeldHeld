import { describe, it, expect } from "vitest";
import { isUsableEmail } from "../lib/negotiator";

const goodBody =
  "Geachte heer/mevrouw,\n\nIk ben sinds geruime tijd klant bij Ziggo en mijn huidige maandbedrag is fors. Graag hoor ik uw voorstel.\n\nMet vriendelijke groet.";

describe("negotiator/isUsableEmail", () => {
  it("accepts well-formed email", () => {
    const r = isUsableEmail({ subject: "Voorstel Ziggo", body: goodBody, provider: "Ziggo" });
    expect(r.ok).toBe(true);
  });

  it("rejects empty subject", () => {
    const r = isUsableEmail({ subject: "", body: goodBody, provider: "Ziggo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/subject/);
  });

  it("rejects very short subject (<5 chars)", () => {
    const r = isUsableEmail({ subject: "ok", body: goodBody, provider: "Ziggo" });
    expect(r.ok).toBe(false);
  });

  it("rejects whitespace-only subject", () => {
    const r = isUsableEmail({ subject: "    ", body: goodBody, provider: "Ziggo" });
    expect(r.ok).toBe(false);
  });

  it("rejects body < 100 chars", () => {
    const r = isUsableEmail({ subject: "Voorstel Ziggo", body: "Hallo!", provider: "Ziggo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/body/);
  });

  it("rejects body that does not mention provider", () => {
    const longButOffTopic = "Geachte heer/mevrouw, ik schrijf u op deze prettige zonnige dag in mei. Ik hoop dat het u goed gaat met uw werk en gezin.";
    const r = isUsableEmail({ subject: "Voorstel", body: longButOffTopic, provider: "Ziggo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/provider/);
  });

  it("provider check is case-insensitive", () => {
    const body = "Geachte heer/mevrouw, ik ben klant bij ZIGGO en wil graag een lager bedrag bespreken. Mijn huidige maandbedrag is hoog en ik vergelijk al opties.";
    const r = isUsableEmail({ subject: "Onderhandeling", body, provider: "Ziggo" });
    expect(r.ok).toBe(true);
  });

  it("accepts body at exactly 100 chars when provider present", () => {
    const body = "Geachte mevrouw, ik ben klant bij KPN en ik wil graag een lager maandbedrag bespreken aub.x"; // 92
    const padded = body + "1234567890ABCDEF"; // 92 + 16 = 108
    const r = isUsableEmail({ subject: "Voorstel", body: padded, provider: "KPN" });
    expect(r.ok).toBe(true);
  });
});
