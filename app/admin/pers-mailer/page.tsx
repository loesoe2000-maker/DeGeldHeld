import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin_auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pers-mailer — Admin" };

type Pitch = {
  to: string;
  contactName: string;
  outlet: string;
  greeting: string;
  extraLine?: string;
  language?: "nl" | "en";
};

const SHARED_NL = `Trim, de Amerikaanse AI-onderhandelaar die in 2021 voor $150M werd verkocht aan Capital One, sloot eind 2024. Sindsdien is er in Europa geen tegenhanger geweest. Ik denk dat dat nu wel zo is.

Afgelopen 90 dagen hebben 27 huishoudens via DeGeldHeld €5.988 bespaard op telecom, energie en verzekeringen. Live cijfers per categorie staan op https://degeldheld.com/proof — geen PR-rapportage, gewoon de database.

Verschil met Trim: 20% éénmalige fee i.p.v. 33% recurring, geen bank-koppeling (AVG-conform), werkt voor élke vaste last.

Geen launch-aankondiging. Wel een vraag: past dit ergens in jullie fintech-coverage? Bereikbaar voor meer informatie of vragen via mail of +31 6 19 03 99 28.

Bas Heling
Oprichter DeGeldHeld
basheling@icloud.com · +31 6 19 03 99 28
https://degeldheld.com · https://degeldheld.com/proof`;

const SHARED_EN = `Trim, the AI bill-negotiator Capital One acquired for $150M in 2021, shut down end of 2024. No European equivalent has emerged since. We think that's now changing.

In the past 90 days, 27 households used DeGeldHeld to cut €5,988 a year off their telecom, energy and insurance bills. Live numbers per category at https://degeldheld.com/proof — no PR, just the database.

Different from Trim: 20% one-off fee instead of 33% recurring, no bank linking required (GDPR-compliant), works for any recurring bill.

Not announcing a launch. Just asking: would this fit your fintech coverage? Available for any follow-up by email or +31 6 19 03 99 28.

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
  },
  {
    to: "tips@sprout.nl",
    contactName: "Sprout-redactie",
    outlet: "Sprout",
    greeting: "Beste Sprout-redactie,",
    extraLine: "Specifiek voor jullie 'ondernemer onder de radar'-rubriek lijkt mij relevant.",
  },
  {
    to: "redactie@bnr.nl",
    contactName: "BNR-redactie",
    outlet: "BNR",
    greeting: "Beste BNR-redactie,",
  },
  {
    to: "tips@thenextweb.com",
    contactName: "tips team",
    outlet: "The Next Web",
    greeting: "Hi tips team,",
    language: "en",
  },
  {
    to: "redactie@emerce.nl",
    contactName: "Emerce-redactie",
    outlet: "Emerce",
    greeting: "Beste Emerce-redactie,",
  },
  {
    to: "redactie@dutchcowboys.nl",
    contactName: "Dutch Cowboys-redactie",
    outlet: "Dutch Cowboys",
    greeting: "Hallo,",
  },
];

const SUBJECT_NL = "Trim sloot in 2024 — wij bespaarden in 90 dagen €5.988 voor 27 huishoudens";
const SUBJECT_EN = "Trim shut down in 2024 — we saved 27 EU households €5,988 in 90 days";

function buildMailto(p: Pitch): string {
  const isEn = p.language === "en";
  const shared = isEn ? SHARED_EN : SHARED_NL;
  const subject = isEn ? SUBJECT_EN : SUBJECT_NL;
  const body = [
    p.greeting,
    "",
    shared.split("\n\n").slice(0, 1).join("\n\n"),
    p.extraLine ? "\n" + p.extraLine : null,
    shared.split("\n\n").slice(1).join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
  return `mailto:${encodeURIComponent(p.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function PersMailerPage() {
  if (!(await isAdmin())) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Pers-mailer</h1>
      <p className="mt-2 text-sm text-slate-600">
        Klik een knop → je default mail-client opent met onderwerp en body
        klaargezet. Controleer kort en klik <strong>Verzenden</strong>.
      </p>

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
            <div>
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
        </ul>
      </section>
    </main>
  );
}
