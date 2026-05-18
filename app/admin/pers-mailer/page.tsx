import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin_auth";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach-mailer — Admin" };

type ContactKind = "press" | "tv" | "partnership" | "influencer";

type Contact = {
  kind: ContactKind;
  to?: string; // null voor influencers (DM ipv mail)
  socialHandle?: string;
  socialPlatform?: "instagram" | "tiktok" | "linkedin";
  outlet: string;
  greeting: string;
  outletHook: string;
  language?: "nl" | "en";
  /** Bewezen dat het adres bestaat (auto-reply of inhoudelijke reactie). */
  verified?: boolean;
  /** Alternatieve web-contact-pagina als email mogelijk niet werkt. */
  webContact?: string;
};

// ─────────────────────────────────────────────────────────────
// TEMPLATES — één per doelgroep-type
// ─────────────────────────────────────────────────────────────

const PRESS_TEMPLATE_NL = `Trim, de Amerikaanse AI-onderhandelaar die in 2021 voor $150M werd verkocht aan Capital One, sloot zes maanden geleden. Sindsdien is er in Europa geen alternatief geweest dat consumenten op dezelfde manier ondersteunt — tot nu.

{OUTLET_HOOK}

In de afgelopen 90 dagen hebben 27 Nederlandse en Belgische huishoudens via DeGeldHeld €5.988 per jaar bespaard op telecom, energie en verzekeringen. Gemiddeld €222 per huishouden, slaag-percentage rond de 70%. De volledige cijfers per categorie staan live op https://degeldheld.com/proof — geen PR-cijfers maar een directe database-uitvoer.

Drie verschillen met Trim. Eén: 20% éénmalige fee op de verifieerde besparing in plaats van 33% recurring. Twee: geen bank-koppeling nodig — wij genereren een onderhandel-mail die de gebruiker zélf verstuurt, AVG-conform vanaf dag één. Drie: tot drie counter-mails per onderhandeling, met AI die het provider-antwoord analyseert.

Achtergrond: ik ben Bas Heling, en ben drie maanden geleden begonnen met DeGeldHeld nadat ik bij mijn eigen KPN-rekening had gezien hoeveel ruimte er zat. Geen funding, geen team — wel een werkend product en gebruikers die elke week meer worden.

Geen launch-aankondiging, geen embargo. Wel een vraag: past dit binnen jullie fintech-coverage? Een reactie op deze mail of een telefoontje op 06 19 03 99 28 is genoeg. Geen Zoom-vereiste — schriftelijk werkt prima.

Met vriendelijke groet,
Bas Heling
Oprichter DeGeldHeld
basheling@icloud.com · +31 6 19 03 99 28
https://degeldheld.com · https://degeldheld.com/proof`;

const PRESS_TEMPLATE_EN = `Trim, the AI bill-negotiator Capital One acquired for $150M in 2021, shut down six months ago. Since then, no European equivalent has supported consumers in the same way — until now.

{OUTLET_HOOK}

In the past 90 days, 27 Dutch and Belgian households have used DeGeldHeld to cut €5,988 a year off their telecom, energy and insurance bills. Average €222 per household, success rate around 70%. The complete numbers per category are live at https://degeldheld.com/proof — not PR figures but a direct database dump.

Three differences from Trim. First: 20% one-off fee on verified savings instead of 33% recurring. Second: no bank linking required — we generate the negotiation email and the user sends it themselves, GDPR-compliant from day one. Third: up to three counter-emails per negotiation, with AI analyzing each provider response.

Background: I'm Bas Heling, founder of DeGeldHeld. I started three months ago after seeing how much room sat in my own KPN bill. No funding, no team — just a working product and a growing user base.

Not a launch announcement, no embargo. Just a question: would this fit your fintech coverage? A reply to this email or a phone call at +31 6 19 03 99 28 is enough.

Best,
Bas Heling
Founder DeGeldHeld
basheling@icloud.com · +31 6 19 03 99 28
https://degeldheld.com · https://degeldheld.com/proof`;

const TV_TEMPLATE = `Vaste lasten zijn de meest stille kostenpost in NL-huishoudens — KPN, Eneco, Centraal Beheer rekenen jaarlijks meer aan loyale klanten dan aan nieuwe. Daar wilden wij iets aan doen.

{OUTLET_HOOK}

DeGeldHeld is een AI die in drie minuten een onderhandel-mail genereert voor je vaste lasten. De gebruiker stuurt 'm zelf naar zijn provider, en als die antwoordt schrijft de AI tot drie counter-mails tot er een akkoord of breekpunt is. In 90 dagen tijd hebben 27 huishoudens samen €5.988 per jaar bespaard. Live cijfers staan op https://degeldheld.com/proof.

Concrete cases om mee te werken: een Eneco-klant die in twee mails €38 per maand naar beneden onderhandelde. Een KPN-klant van zeven jaar die €120 jaarbesparing realiseerde door alleen het klantbehoud-team te benoemen. Dit zijn niet de uitzonderingen — dit is wat er gebeurt zodra mensen het juiste woordenboek gebruiken.

Ik ben Bas Heling, oprichter. Geen team, geen funding — gewoon iemand die zelf gefrustreerd was over zijn KPN-rekening en het kon bouwen. Ik denk dat dit een interessant verhaal kan zijn voor jullie kijkers/luisteraars: hoe een simpele AI-tool huishoudens hun eigen marktmacht teruggeeft.

Beschikbaar voor verdere informatie via mail of 06 19 03 99 28. Geen voorbereiding nodig — kan ook gewoon kort telefonisch toelichten.

Met vriendelijke groet,
Bas Heling
DeGeldHeld
basheling@icloud.com · +31 6 19 03 99 28
https://degeldheld.com/proof`;

const PARTNERSHIP_TEMPLATE = `Jullie achterban heeft één gedeelde frustratie: vaste lasten lopen op zonder dat er goede tools zijn om er actief iets aan te doen.

{OUTLET_HOOK}

Ik ben Bas Heling, oprichter van DeGeldHeld. Wij hebben een AI-tool gebouwd die in drie minuten een onderhandel-mail genereert voor telecom, energie, verzekering en andere maandelijkse contracten. Gebruiker verstuurt zelf, AI schrijft counter-mails bij elke provider-reactie. In 90 dagen 27 huishoudens, €5.988 bespaard — live op https://degeldheld.com/proof.

Mogelijke samenwerking: een tab/widget/link op jullie ledenpagina waar jullie achterban DeGeldHeld kan gebruiken. Wij zorgen voor zichtbaarheid van jullie merk in onze flow en delen aggregaat-data (geen persoonsgegevens) over wat jullie achterban gemiddeld bespaart — bruikbaar voor jullie eigen content en advocacy.

Geen exclusieve deal nodig, geen kosten voor jullie. Voor ons: jullie bereik. Voor jullie achterban: een concrete tool die geld bespaart.

Geïnteresseerd om eens te kijken? Een mail-reactie of telefoontje op 06 19 03 99 28 is genoeg om een eerste afspraak in te plannen.

Met vriendelijke groet,
Bas Heling
Oprichter DeGeldHeld
basheling@icloud.com · +31 6 19 03 99 28
https://degeldheld.com`;

const INFLUENCER_TEMPLATE_NL = `Hé {NAAM},

Ik volg je content over geld besparen al een tijdje en denk dat dit iets voor jou kan zijn.

Drie maanden geleden ben ik DeGeldHeld gestart: een AI die in drie minuten een onderhandel-mail schrijft voor je vaste lasten (telecom, energie, verzekering). Tot nu toe hebben 27 huishoudens er €5.988 per jaar mee bespaard. Cijfers live op https://degeldheld.com/proof.

Mijn vraag: wil je het gratis proberen op een eigen factuur en — als 't werkt — er een video of post over maken? Geen sponsoring, geen vergoeding, geen voorgekauwde tekst. Gewoon eerlijk delen wat er gebeurt als jij 't probeert. Als het niet werkt of niets oplevert ook prima — dan hoor ik dat ook graag.

Login via degeldheld.com is gratis en duurt 30 seconden. Mocht je vragen hebben, mail of WhatsApp/bel naar 06 19 03 99 28.

Groet,
Bas Heling`;

// ─────────────────────────────────────────────────────────────
// CONTACTEN
// ─────────────────────────────────────────────────────────────

const CONTACTS: Contact[] = [
  // ─── PERS TIER 1 ───
  {
    kind: "press",
    to: "sandra.olsthoorn@fd.nl",
    outlet: "FD — Sandra Olsthoorn",
    greeting: "Beste Sandra,",
    outletHook:
      "Sandra, jouw eerdere stukken over consumer-fintech en de spanning tussen Big Tech en kleinere NL-spelers raken precies de hoek waar dit verhaal zit.",
  },
  {
    kind: "press",
    to: "redactie@sprout.nl",
    webContact: "https://www.sprout.nl/contact",
    outlet: "Sprout",
    greeting: "Beste Sprout-redactie,",
    outletHook:
      "Specifiek voor jullie 'ondernemer onder de radar'-rubriek lijkt het mij relevant — een NL-product dat een €150M Amerikaanse markt-leider opvolgt zonder team of funding.",
  },
  {
    kind: "press",
    to: "redactie@bnr.nl",
    outlet: "BNR Newsroom",
    greeting: "Beste BNR-redactie,",
    verified: true,
    outletHook:
      "Voor BNR Newsroom lijkt het mij een audio-vriendelijk verhaal: concreet, één founder, harde cijfers en directe relevantie voor luisteraars met dure vaste lasten.",
  },
  {
    kind: "press",
    to: "tips@thenextweb.com",
    outlet: "The Next Web",
    greeting: "Hi tips team,",
    language: "en",
    outletHook:
      "This fits the EU post-Trim fintech coverage you've been running — Amsterdam-built, GDPR-native, and tangibly different from US consumer-fintech assumptions.",
  },
  {
    kind: "press",
    to: "redactie@emerce.nl",
    outlet: "Emerce",
    greeting: "Beste Emerce-redactie,",
    outletHook:
      "Past goed bij jullie consumer-fintech coverage — een AI-product dat draait om gedragsverandering bij gewone NL-huishoudens, niet bij power-users of zakelijke klanten.",
  },
  {
    kind: "press",
    to: "redactie@dutchcowboys.nl",
    outlet: "Dutch Cowboys",
    greeting: "Hallo,",
    outletHook:
      "Voor de Dutch Cowboys-lezers lijkt mij dit een passend stuk: tastbaar AI-gebruik dat geld bespaart, geen abstract '2030 transformation' verhaal.",
  },

  // ─── PERS TIER 2 ───
  {
    kind: "press",
    to: "redactie@quote.nl",
    outlet: "Quote",
    greeting: "Beste Quote-redactie,",
    outletHook:
      "Voor Quote: een founder zonder team of funding die concurreert met een $150M Amerikaanse marktleider. Past bij jullie 'ondernemer-portret'-genre.",
  },
  {
    kind: "press",
    to: "redactie@iex.nl",
    outlet: "IEX",
    greeting: "Beste IEX-redactie,",
    outletHook:
      "Voor IEX-lezers is dit direct relevant — een tool die financiële assertiviteit aanjaagt bij gewone consumenten, vergelijkbaar met wat IEX voor beleggers doet.",
  },
  {
    kind: "press",
    to: "redactie@tweakers.net",
    outlet: "Tweakers",
    greeting: "Hallo Tweakers-redactie,",
    outletHook:
      "Voor Tweakers: een NL-AI-product met concrete output (€5.988 bespaard), open infrastructuur (Groq/Vercel/Neon), en transparante methodologie via /proof.",
  },

  // ─── CONSUMER TV/RADIO ───
  {
    kind: "tv",
    to: "kassa@bnnvara.nl",
    webContact: "https://kassa.bnnvara.nl/meld",
    outlet: "Kassa (BNNVARA)",
    greeting: "Beste Kassa-redactie,",
    outletHook:
      "Voor Kassa: dit is exact het type item dat raakt aan jullie kijkers — providers die loyale klanten meer rekenen, en hoe een simpele AI-tool die machtsbalans omdraait.",
  },
  {
    kind: "tv",
    to: "radar@avrotros.nl",
    webContact: "https://radar.avrotros.nl/meld",
    outlet: "Radar (AVROTROS)",
    greeting: "Beste Radar-redactie,",
    outletHook:
      "Voor Radar: een consumenten-tool die actief geld bespaart bij precies de bedrijven waar jullie regelmatig over berichten — energie, telecom, verzekering.",
  },
  {
    kind: "tv",
    webContact: "https://eenvandaag.avrotros.nl/contact",
    outlet: "EenVandaag",
    greeting: "Beste EenVandaag-redactie,",
    outletHook:
      "Voor EenVandaag: koopkracht is een doorlopend thema in NL. DeGeldHeld biedt huishoudens een concrete, gratis tool — meer hands-on dan een vergelijker, minder commercieel dan een vergelijkingssite.",
  },
  {
    kind: "tv",
    webContact: "https://www.hartvannederland.nl/contact",
    outlet: "Hart van Nederland",
    greeting: "Hallo,",
    outletHook:
      "Voor Hart van Nederland: een Hollands verhaal van een ondernemer die in z'n eentje een tool bouwde die nu écht geld bespaart voor 27 gezinnen.",
  },

  // ─── PARTNERSHIPS ───
  {
    kind: "partnership",
    to: "redactie@consumentenbond.nl",
    outlet: "Consumentenbond",
    greeting: "Beste Consumentenbond-team,",
    outletHook:
      "De Consumentenbond is dé belangenbehartiger in NL voor consumenten richting providers. DeGeldHeld kan een gratis tool zijn die jullie leden actief inzetten — wij rekenen 20% van verifieerde besparing, jullie leden houden de rest.",
  },
  {
    kind: "partnership",
    to: "info@geldfit.nl",
    outlet: "Geldfit",
    greeting: "Beste Geldfit-team,",
    outletHook:
      "Geldfit ondersteunt mensen die financieel kwetsbaar zijn. Voor die groep is besparen op vaste lasten vaak het verschil tussen rondkomen en niet. DeGeldHeld is gratis voor hen die <€25/jaar besparen — bij grotere besparingen kunnen jullie leden 80% behouden.",
  },
  {
    kind: "partnership",
    to: "info@vereniging.nl",
    outlet: "Vereniging Eigen Huis",
    greeting: "Beste VEH-team,",
    outletHook:
      "VEH-leden hebben gemiddeld 4-5 verzekeringen plus een hypotheek. DeGeldHeld kan voor hen specifiek werken op verzekering-premies en hypotheekrente. Bruikbaar als ledenvoordeel-feature.",
  },
  {
    kind: "partnership",
    to: "redactie@anwb.nl",
    outlet: "ANWB",
    greeting: "Beste ANWB-team,",
    outletHook:
      "Voor ANWB-leden is autoverzekering een terugkerend pijnpunt. DeGeldHeld kan hier samen met jullie iets opzetten — wij doen de onderhandeling, jullie communiceren naar de leden.",
  },

  // ─── NANO-INFLUENCERS (DM, geen email) ───
  {
    kind: "influencer",
    socialHandle: "hildebonenkamp",
    socialPlatform: "instagram",
    outlet: "Hilde Bonenkamp (35k IG)",
    greeting: "Hé Hilde,",
    outletHook: "",
  },
  {
    kind: "influencer",
    socialHandle: "sven.dekruijf",
    socialPlatform: "tiktok",
    outlet: "Sven de Kruijf (TikTok finance)",
    greeting: "Hé Sven,",
    outletHook: "",
  },
  {
    kind: "influencer",
    socialHandle: "vrouwengeld",
    socialPlatform: "instagram",
    outlet: "Vrouwengeld (NL)",
    greeting: "Hoi Vrouwengeld-team,",
    outletHook: "",
  },
  {
    kind: "influencer",
    socialHandle: "geldzondergedoe",
    socialPlatform: "instagram",
    outlet: "Geld Zonder Gedoe",
    greeting: "Hé,",
    outletHook: "",
  },
];

const SUBJECTS: Record<ContactKind, { nl: string; en?: string }> = {
  press: {
    nl: "Trim sloot eind 2024 — wij bespaarden in 90 dagen €5.988 voor 27 huishoudens",
    en: "Trim shut down end of 2024 — we saved 27 EU households €5,988 in 90 days",
  },
  tv: {
    nl: "Verhaal-idee: AI bespaarde 27 NL-huishoudens samen €5.988 op vaste lasten",
  },
  partnership: {
    nl: "Samenwerking-voorstel: gratis bespaartool voor jullie achterban",
  },
  influencer: {
    nl: "Gratis trial voor jouw publiek?",
  },
};

function buildMailto(c: Contact): string | null {
  if (!c.to) return null;
  const isEn = c.language === "en";
  const subj = isEn ? SUBJECTS[c.kind].en ?? SUBJECTS[c.kind].nl : SUBJECTS[c.kind].nl;
  const template =
    c.kind === "press"
      ? isEn
        ? PRESS_TEMPLATE_EN
        : PRESS_TEMPLATE_NL
      : c.kind === "tv"
        ? TV_TEMPLATE
        : c.kind === "partnership"
          ? PARTNERSHIP_TEMPLATE
          : INFLUENCER_TEMPLATE_NL;
  const filled = template.replace("{OUTLET_HOOK}", c.outletHook);
  const body = `${c.greeting}\n\n${filled}`;
  return `mailto:${encodeURIComponent(c.to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
}

function buildMessageText(c: Contact): string {
  const isEn = c.language === "en";
  const subj = isEn ? SUBJECTS[c.kind].en ?? SUBJECTS[c.kind].nl : SUBJECTS[c.kind].nl;
  const template =
    c.kind === "press"
      ? isEn
        ? PRESS_TEMPLATE_EN
        : PRESS_TEMPLATE_NL
      : c.kind === "tv"
        ? TV_TEMPLATE
        : c.kind === "partnership"
          ? PARTNERSHIP_TEMPLATE
          : INFLUENCER_TEMPLATE_NL;
  const filled = template.replace("{OUTLET_HOOK}", c.outletHook);
  return `Onderwerp: ${subj}\n\n${c.greeting}\n\n${filled}`;
}

function buildSocialDeepLink(c: Contact): string | null {
  if (!c.socialHandle || !c.socialPlatform) return null;
  if (c.socialPlatform === "instagram") return `https://www.instagram.com/${c.socialHandle}/`;
  if (c.socialPlatform === "tiktok") return `https://www.tiktok.com/@${c.socialHandle}`;
  if (c.socialPlatform === "linkedin") return `https://www.linkedin.com/in/${c.socialHandle}/`;
  return null;
}

function buildInfluencerDmText(c: Contact, namePlaceholder: string): string {
  const filled = INFLUENCER_TEMPLATE_NL.replace("{NAAM}", namePlaceholder);
  return `${c.greeting}\n\n${filled}`;
}

const GROUP_LABELS: Record<ContactKind, string> = {
  press: "Pers",
  tv: "Consumer TV / radio",
  partnership: "Partnerships",
  influencer: "Nano-influencers (DM)",
};

const GROUP_NOTES: Record<ContactKind, string> = {
  press:
    "230 woorden, 5 alinea's, founder-context erin, persoonlijke zin per uitgever. 2 vandaag + 2 over 2 dagen + 2 vrijdag.",
  tv: "Concrete cases, mensgericht, geen tech-jargon. Stuur over de spreid van een week (1 per dag).",
  partnership: "Mutual-benefit toon. Geef expliciet aan: jullie leden mogen 80% besparing behouden.",
  influencer:
    "Geen email — DM. Klik handle → opent IG/TikTok-profiel. Open DM, plak gepersonaliseerde tekst, druk verzenden.",
};

export default async function PersMailerPage() {
  if (!(await isAdmin())) redirect("/dashboard");

  const groups: ContactKind[] = ["press", "tv", "partnership", "influencer"];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Outreach-mailer</h1>
      <p className="mt-2 text-sm text-slate-600">
        20 gepersonaliseerde berichten verdeeld over vier doelgroepen. Klik een knop → mail-client opent
        met onderwerp + body klaargezet. Voor influencers: klik handle → DM-flow op IG/TikTok.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {groups.map((g) => {
          const count = CONTACTS.filter((c) => c.kind === g).length;
          return (
            <a
              key={g}
              href={`#group-${g}`}
              className="rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {GROUP_LABELS[g]}
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{count}</div>
            </a>
          );
        })}
      </div>

      {groups.map((g) => {
        const items = CONTACTS.filter((c) => c.kind === g);
        return (
          <section key={g} id={`group-${g}`} className="mt-12 scroll-mt-6">
            <h2 className="text-2xl font-bold text-slate-900">{GROUP_LABELS[g]}</h2>
            <p className="mt-1 text-sm text-slate-600">{GROUP_NOTES[g]}</p>

            <ul className="mt-5 space-y-3">
              {items.map((c, i) => {
                const mailto = buildMailto(c);
                const social = buildSocialDeepLink(c);
                return (
                  <li
                    key={c.outlet}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-900">{c.outlet}</span>
                        {c.language === "en" && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                            EN
                          </span>
                        )}
                      </div>
                      {c.to && (
                        <div className="mt-1 text-sm text-slate-600">
                          <code className="rounded bg-slate-50 px-1.5 py-0.5 text-xs">{c.to}</code>
                        </div>
                      )}
                      {c.socialHandle && (
                        <div className="mt-1 text-sm text-slate-600">
                          DM op {c.socialPlatform} ·{" "}
                          <code className="rounded bg-slate-50 px-1.5 py-0.5 text-xs">@{c.socialHandle}</code>
                        </div>
                      )}
                      {c.outletHook && (
                        <details className="mt-2 text-xs text-slate-500">
                          <summary className="cursor-pointer text-brand-700">
                            Persoonlijke zin in alinea 2
                          </summary>
                          <p className="mt-1 italic">{c.outletHook}</p>
                        </details>
                      )}
                      {c.kind === "influencer" && (
                        <details className="mt-2 text-xs text-slate-500">
                          <summary className="cursor-pointer text-brand-700">
                            DM-tekst kopiëren
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-[11px]">
                            {buildInfluencerDmText(c, c.outlet.split(" ")[0])}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.verified ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                            Geverifieerd
                          </span>
                        ) : c.to ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Onbevestigd
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {mailto && (
                          <a
                            href={mailto}
                            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                          >
                            Open mail →
                          </a>
                        )}
                        {c.webContact && (
                          <a
                            href={c.webContact}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100"
                          >
                            Web-form →
                          </a>
                        )}
                        {social && (
                          <a
                            href={social}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Open profiel →
                          </a>
                        )}
                        {(c.webContact || c.kind === "influencer") && (
                          <CopyButton
                            text={buildMessageText(c)}
                            label="Kopieer tekst"
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        <h3 className="text-base font-semibold text-slate-900">Verzend-protocol</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li><strong>Week 1</strong>: Pers Tier 1 (FD, Sprout, BNR, TNW, Emerce, DC) — 2 per dag</li>
          <li><strong>Week 2</strong>: Pers Tier 2 (Quote, IEX, Tweakers) + TV/radio</li>
          <li><strong>Week 3</strong>: Partnerships (Consumentenbond, Geldfit, VEH, ANWB)</li>
          <li><strong>Parallel</strong>: influencer DMs — 4 per dag, niet meer (anti-spam vlag)</li>
          <li>Bij reactie binnen 24u: bedank en lever 2-3 cijfers vooraf (bespaard bedrag, slaag-rate, top-categorie)</li>
          <li>Geen reactie na 5 dagen: één LinkedIn-DM, geen email-reply</li>
        </ul>
      </section>
    </main>
  );
}
