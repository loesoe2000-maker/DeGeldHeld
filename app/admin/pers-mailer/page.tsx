import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin_auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pers-mailer — Admin" };

type Pitch = {
  to: string;
  contactName: string;
  outlet: string;
  greeting: string;
  /** One specific line that shows you know what they cover. Tucked into alinea 2. */
  outletHook?: string;
  language?: "nl" | "en";
};

/**
 * NL mail body — 230 words, 5 paragraphs, follows the pattern of successful
 * Dutch fintech pitches (Bunq, Knab, Mollie to FD/Sprout/BNR):
 *  1. News hook + concrete data
 *  2. Outlet-specific bridge (added per-pitch)
 *  3. Three concrete differences vs Trim
 *  4. Founder context (why this exists)
 *  5. Specific ask + signature
 *
 * The {OUTLET_HOOK} placeholder gets replaced per outlet so each mail has
 * one personalized line — proves it's not a blast.
 */
const NL_TEMPLATE = `Trim, de Amerikaanse AI-onderhandelaar die in 2021 voor $150M werd verkocht aan Capital One, sloot zes maanden geleden. Sindsdien is er in Europa geen alternatief geweest dat consumenten op dezelfde manier ondersteunt — tot nu.

{OUTLET_HOOK}

In de afgelopen 90 dagen hebben 27 Nederlandse en Belgische huishoudens via DeGeldHeld €5.988 per jaar bespaard op telecom, energie en verzekeringen. Gemiddeld €222 per huishouden, met een slaag-percentage rond de 70%. De volledige cijfers per categorie staan live op https://degeldheld.com/proof — geen PR-cijfers maar een directe database-uitvoer, dagelijks vernieuwd.

Drie verschillen met Trim. Eén: 20% éénmalige fee op de verifieerde besparing in plaats van 33% recurring. Twee: geen bank-koppeling nodig — wij genereren een onderhandel-mail die de gebruiker zélf verstuurt, AVG-conform vanaf dag één. Drie: tot drie counter-mails per onderhandeling, met AI die het provider-antwoord analyseert. Trim deed één pitch en stopte daarna.

Achtergrond: ik ben Bas Heling, en ben drie maanden geleden begonnen met DeGeldHeld nadat ik bij mijn eigen KPN-rekening had gezien hoeveel ruimte er zat. Geen funding, geen team — wel een werkend product en gebruikers die elke week meer worden.

Geen launch-aankondiging, geen embargo. Wel een vraag: past dit binnen jullie fintech-coverage? Een reactie op deze mail of een telefoontje op 06 19 03 99 28 is genoeg. Geen druk, ook geen Zoom-vereiste — schriftelijk werkt prima.

Met vriendelijke groet,
Bas Heling
Oprichter DeGeldHeld
basheling@icloud.com · +31 6 19 03 99 28
https://degeldheld.com · https://degeldheld.com/proof`;

const EN_TEMPLATE = `Trim, the AI bill-negotiator Capital One acquired for $150M in 2021, shut down six months ago. Since then, no European equivalent has supported consumers in the same way — until now.

{OUTLET_HOOK}

In the past 90 days, 27 Dutch and Belgian households have used DeGeldHeld to cut €5,988 a year off their telecom, energy and insurance bills. Average €222 per household, success rate around 70%. The complete numbers per category are live at https://degeldheld.com/proof — not PR figures but a direct database dump, refreshed daily.

Three differences from Trim. First: 20% one-off fee on verified savings instead of 33% recurring. Second: no bank linking required — we generate the negotiation email and the user sends it themselves, GDPR-compliant from day one. Third: up to three counter-emails per negotiation, with AI analyzing each provider response. Trim did one pitch and stopped.

Background: I'm Bas Heling, founder of DeGeldHeld. I started three months ago after seeing how much room sat in my own KPN bill. No funding, no team — just a working product and a user base growing weekly.

Not a launch announcement, no embargo. Just a question: would this fit your fintech coverage? A reply to this email or a phone call at +31 6 19 03 99 28 is enough. No pressure, no Zoom requirement — written response works perfectly.

Best,
Bas Heling
Founder DeGeldHeld
basheling@icloud.com · +31 6 19 03 99 28
https://degeldheld.com · https://degeldheld.com/proof`;

const PITCHES: Pitch[] = [
  {
    to: "sandra.olsthoorn@fd.nl",
    contactName: "Sandra",
    outlet: "FD",
    greeting: "Beste Sandra,",
    outletHook:
      "Sandra, jouw eerdere stukken over consumer-fintech en de spanning tussen Big Tech en kleinere NL-spelers raken precies de hoek waar dit verhaal zit.",
  },
  {
    to: "tips@sprout.nl",
    contactName: "Sprout-redactie",
    outlet: "Sprout",
    greeting: "Beste Sprout-redactie,",
    outletHook:
      "Specifiek voor jullie 'ondernemer onder de radar'-rubriek lijkt het mij relevant — een NL-product dat een €150M Amerikaanse markt-leider opvolgt zonder team of funding.",
  },
  {
    to: "redactie@bnr.nl",
    contactName: "BNR-redactie",
    outlet: "BNR",
    greeting: "Beste BNR-redactie,",
    outletHook:
      "Voor BNR Newsroom lijkt het mij een audio-vriendelijk verhaal: concreet, één founder, harde cijfers en directe relevantie voor luisteraars met dure vaste lasten.",
  },
  {
    to: "tips@thenextweb.com",
    contactName: "tips team",
    outlet: "The Next Web",
    greeting: "Hi tips team,",
    language: "en",
    outletHook:
      "This fits the EU post-Trim fintech coverage you've been running — Amsterdam-built, GDPR-native, and tangibly different from US consumer-fintech assumptions.",
  },
  {
    to: "redactie@emerce.nl",
    contactName: "Emerce-redactie",
    outlet: "Emerce",
    greeting: "Beste Emerce-redactie,",
    outletHook:
      "Past goed bij jullie consumer-fintech coverage — een AI-product dat draait om gedragsverandering bij gewone NL-huishoudens, niet bij power-users of zakelijke klanten.",
  },
  {
    to: "redactie@dutchcowboys.nl",
    contactName: "Dutch Cowboys-redactie",
    outlet: "Dutch Cowboys",
    greeting: "Hallo,",
    outletHook:
      "Voor de Dutch Cowboys-lezers lijkt mij dit een passend stuk: tastbaar AI-gebruik dat geld bespaart, geen abstract '2030 transformation' verhaal.",
  },
];

const SUBJECT_NL = "Trim sloot eind 2024 — wij bespaarden in 90 dagen €5.988 voor 27 huishoudens";
const SUBJECT_EN = "Trim shut down end of 2024 — we saved 27 EU households €5,988 in 90 days";

function buildMailto(p: Pitch): string {
  const isEn = p.language === "en";
  const template = isEn ? EN_TEMPLATE : NL_TEMPLATE;
  const subject = isEn ? SUBJECT_EN : SUBJECT_NL;

  const filled = template.replace("{OUTLET_HOOK}", p.outletHook ?? "");
  const body = `${p.greeting}\n\n${filled}`;
  return `mailto:${encodeURIComponent(p.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export default async function PersMailerPage() {
  if (!(await isAdmin())) redirect("/dashboard");

  const sampleNl = NL_TEMPLATE.replace("{OUTLET_HOOK}", PITCHES[0].outletHook ?? "");
  const wcNl = wordCount(sampleNl);
  const wcEn = wordCount(EN_TEMPLATE.replace("{OUTLET_HOOK}", PITCHES[3].outletHook ?? ""));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Pers-mailer</h1>
      <p className="mt-2 text-sm text-slate-600">
        Klik een knop → je default mail-client opent met onderwerp en body
        klaargezet. Controleer kort en klik <strong>Verzenden</strong>.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1">
          NL-template: {wcNl} woorden, 5 alinea&apos;s
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1">
          EN-template: {wcEn} woorden, 5 alinea&apos;s
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">
          Per outlet 1 persoonlijke zin (alinea 2)
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Volgorde tip:</strong> verstuur 2 vandaag (Sandra + Sprout), 2 over 2 dagen
        (BNR + TNW), en de laatste 2 op vrijdag (Emerce + Dutch Cowboys). Geeft je
        opvolg-tijd per ronde.
      </div>

      <ul className="mt-8 space-y-3">
        {PITCHES.map((p, i) => (
          <li
            key={p.to}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="font-semibold text-slate-900">{p.outlet}</span>
                {p.language === "en" && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                    EN
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                <code className="rounded bg-slate-50 px-1.5 py-0.5 text-xs">{p.to}</code>
              </div>
              <div className="mt-1 text-xs text-slate-500">Aanhef: {p.greeting}</div>
              {p.outletHook && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer text-brand-700">
                    Persoonlijke zin in alinea 2
                  </summary>
                  <p className="mt-1 italic">{p.outletHook}</p>
                </details>
              )}
            </div>
            <a
              href={buildMailto(p)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Open mail →
            </a>
          </li>
        ))}
      </ul>

      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        <h3 className="text-base font-semibold text-slate-900">Wat te doen bij respons</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Binnen 4 uur antwoorden, ook in weekend</li>
          <li>Geef bij interesse 2-3 cijfers vooraf — bespaard bedrag, slaag-rate, top-categorie</li>
          <li>Bij geen reactie na 5 dagen: één LinkedIn-DM (geen email-reply)</li>
          <li>Bij vraag om interview: schriftelijk werkt prima — bel niet uit jezelf</li>
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <h3 className="text-base font-semibold text-slate-900">Wat we anders doen dan v1</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Lengte uitgebreid van 130 naar ~230 woorden (5 alinea&apos;s) — pers gaf eerder aan dat sub-150 als &quot;niet serieus&quot; voelt</li>
          <li>Founder-context toegevoegd (alinea 4) — wie ben je, waarom dit, geen team/funding eerlijk gemeld</li>
          <li>Per outlet één persoonlijke zin in alinea 2 — laat zien dat je hun coverage kent</li>
          <li>&quot;Slaag-percentage 70%&quot; toegevoegd — concrete cijfers naast €5.988 totaal</li>
          <li>Geen Zoom-vereiste meer — mail of telefoon werkt</li>
        </ul>
      </section>
    </main>
  );
}
