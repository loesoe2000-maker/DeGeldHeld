/**
 * lib/demo-fixtures.ts — Fake bills + analyses + mails voor /demo.
 *
 * GEEN DB-call, GEEN auth, ALLES in memory. Drie scenario's zodat
 * een nieuwe bezoeker de volledige flow kan zien zonder upload.
 */

export type DemoFixture = {
  id: "telecom" | "energie" | "verzekering";
  label: string;
  emoji: string;
  bill: {
    provider: string;
    plan: string;
    category: "TELECOM" | "ENERGIE" | "VERZEKERING";
    monthlyCents: number;
    period: string;
  };
  analysis: {
    marketMedianMonthlyCents: number;
    yearlySavingsCents: number;
    alternatives: Array<{ name: string; monthlyCents: number; notes: string }>;
    note: string;
  };
  mail: {
    subject: string;
    body: string;
    strategy: string;
    reasoning: string;
    confidence: number;
  };
};

export const DEMO_FIXTURES: DemoFixture[] = [
  {
    id: "telecom",
    label: "KPN telefoon-abonnement",
    emoji: "📱",
    bill: {
      provider: "KPN",
      plan: "Compleet Unlimited",
      category: "TELECOM",
      monthlyCents: 2965,
      period: "mei 2026",
    },
    analysis: {
      marketMedianMonthlyCents: 2199,
      yearlySavingsCents: 9192,
      alternatives: [
        { name: "Simyo", monthlyCents: 1499, notes: "KPN-netwerk, geen toestelkrediet" },
        { name: "Ben", monthlyCents: 1799, notes: "Odido-netwerk, prijs-vast 12mnd" },
        { name: "hollandsnieuwe", monthlyCents: 2199, notes: "KPN-netwerk, alles uit één hand" },
      ],
      note: "Je betaalt €7,66/mnd boven markt-mediaan voor een vergelijkbaar pakket.",
    },
    mail: {
      subject: "Verzoek tariefherziening KPN — klantnummer 12345678",
      strategy: "SWITCH_CLAIM",
      confidence: 0.78,
      reasoning: "Concurrenten bieden vergelijkbare pakketten voor €15-€22/mnd. SWITCH_CLAIM met concrete alternatieven werkt het beste voor TELECOM.",
      body: `Geachte heer/mevrouw,

Ik schrijf u over mijn KPN-account (klantnr 12345678). Ik ben al meerdere jaren klant bij KPN Compleet Unlimited, met een huidig maandbedrag van €29,65.

Ik heb mijn contract vergeleken met het huidige marktaanbod. Simyo biedt momenteel een vergelijkbaar pakket voor €14,99 per maand — dat is €176 per jaar minder dan wat ik nu bij u betaal. Ook andere aanbieders bieden soortgelijke tarieven.

Ik hecht waarde aan continuïteit en blijf liever bij KPN. Daarom vraag ik u mijn maandbedrag te verlagen naar €22,00. Indien dat niet mogelijk is, zal ik binnen 30 dagen overstappen.

Ik ontvang graag uw concrete voorstel binnen 14 werkdagen op dit e-mailadres.

Met vriendelijke groet,
[Jouw naam]`,
    },
  },
  {
    id: "energie",
    label: "Eneco stroom + gas",
    emoji: "⚡",
    bill: {
      provider: "Eneco",
      plan: "Variabel Stroom + Gas",
      category: "ENERGIE",
      monthlyCents: 18500,
      period: "april 2026",
    },
    analysis: {
      marketMedianMonthlyCents: 14250,
      yearlySavingsCents: 51000,
      alternatives: [
        { name: "Vandebron", monthlyCents: 13900, notes: "100% groen, NL-bron" },
        { name: "Frank Energie", monthlyCents: 14150, notes: "Dynamisch tarief met cap" },
        { name: "Greenchoice", monthlyCents: 14400, notes: "CO₂-compensatie inbegrepen" },
      ],
      note: "Je kWh-prijs zit €0,03 boven mediaan en je vastrecht €2/mnd hoger.",
    },
    mail: {
      subject: "Verzoek herziening kWh-tarief — Eneco klantnummer 87654321",
      strategy: "RETENTIE_DREIG",
      confidence: 0.71,
      reasoning: "ENERGIE-providers reageren sterk op concrete kWh-vergelijking met een goedkoper alternatief. RETENTIE_DREIG met overstap-deadline werkt.",
      body: `Geachte heer/mevrouw,

Ik schrijf u over mijn Eneco-account voor stroom en gas (klantnr 87654321). Ik betaal momenteel €185 per maand voor variabel tarief.

Op basis van de huidige markt-tarieven zou ik bij overstap naar Vandebron of Frank Energie minimaal €510 per jaar besparen, met vergelijkbare of betere groene certificering.

Ik blijf graag bij Eneco, mits het tarief marktconform wordt. Concreet vraag ik:
- Verlaging kWh-prijs naar markt-mediaan (€0,28/kWh)
- Vastrecht reductie naar maximaal €6/mnd

Mocht u dit niet kunnen aanbieden, zeg ik mijn contract op per einde van de huidige termijn.

Met vriendelijke groet,
[Jouw naam]`,
    },
  },
  {
    id: "verzekering",
    label: "Centraal Beheer autoverzekering",
    emoji: "🚗",
    bill: {
      provider: "Centraal Beheer",
      plan: "WA+ Volkswagen Polo",
      category: "VERZEKERING",
      monthlyCents: 2890,
      period: "mei 2026",
    },
    analysis: {
      marketMedianMonthlyCents: 2350,
      yearlySavingsCents: 6480,
      alternatives: [
        { name: "Inshared", monthlyCents: 1720, notes: "Online-only, eigen risico €150" },
        { name: "Promovendum", monthlyCents: 1850, notes: "Korting hbo/wo-opgeleiden" },
        { name: "Univé", monthlyCents: 1990, notes: "Schadevrije jaren behouden bij overstap" },
      ],
      note: "Je premie zit in het duurste kwartiel voor WA+ verzekeringen.",
    },
    mail: {
      subject: "Premie-verlaging WA+ verzekering — polisnummer X1234567",
      strategy: "MATCH_OFFER",
      confidence: 0.65,
      reasoning: "Verzekeraars matchen vaak goedkopere offertes om bestaande klanten te behouden. MATCH_OFFER met concrete alternatieven uit dezelfde dekking-klasse werkt.",
      body: `Geachte heer/mevrouw,

Ik schrijf u over mijn WA+ autoverzekering bij Centraal Beheer (polisnr X1234567). Mijn huidige maandpremie bedraagt €28,90.

Vergelijkbare offertes met dezelfde dekking (WA+ voor Volkswagen Polo 2018):
- Inshared: €17,20/mnd
- Promovendum: €18,50/mnd
- Univé: €19,90/mnd

Dat is ~€65 per jaar voordeliger. Ik waardeer de goede schadeservice die ik bij u heb ervaren en wil graag klant blijven. Kunt u een voorstel doen dat marktconform is, bij voorkeur richting €19-€22 per maand?

Ik ontvang graag uw reactie binnen 14 werkdagen.

Met vriendelijke groet,
[Jouw naam]`,
    },
  },
];

export function getDemoFixture(id: string): DemoFixture | undefined {
  return DEMO_FIXTURES.find((f) => f.id === id);
}
