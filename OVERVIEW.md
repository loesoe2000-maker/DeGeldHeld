# DeGeldHeld — Kort & krachtig overzicht

*Bijgewerkt: 19 mei 2026*

---

## In één zin

DeGeldHeld is een AI die je vaste lasten verlaagt — upload factuur, krijg onderhandel-mail, AI schrijft counter-mails als provider antwoordt. 20% no-cure-no-pay op verifieerde besparing.

---

## Tech stack — welke apps draaien de site

| Service | Wat het doet | Prijs nu | Status |
|---|---|---|---|
| **Vercel** | Hosting + auto-deploys vanaf GitHub | €0 (hobby tier) | ✅ Actief |
| **Cloudflare** | DNS voor degeldheld.com | $10/jaar (domein) | ✅ Actief |
| **Neon** | PostgreSQL database (EU) | €0 (free tier) | ✅ Actief |
| **Prisma** | ORM voor database queries | €0 (open source) | ✅ Actief |
| **NextAuth (Auth.js)** | Magic-link login | €0 (open source) | ✅ Actief |
| **Resend** | Email API (outgoing + inbound) | €0 (3k mails/mnd) | ✅ Actief |
| **Groq** | AI voor OCR + onderhandel-mails | €0 (free tier) | ✅ Actief |
| **Stripe** | Betalingen (sandbox-mode nu) | 1.4% + €0,25 per trans. | ⏳ Test-mode |
| **Sentry** | Error tracking + alerts | €0 (5k events/mnd) | ⚠️ Verkeerd project |
| **GitHub** | Code repository | €0 | ✅ Actief |
| **Higgsfield** | AI video generatie voor marketing | $49/mnd (Plus, koop morgen) | ⏳ Nog kopen |

**Totale maandelijkse kosten**: ~€0 nu, ~€49 vanaf morgen (Higgsfield).

---

## Kern-functionaliteit (wat werkt op de site)

### Voor bezoekers
- **Anonymous upload** (v15) — factuur uploaden zonder account
- **Analyse zonder login** — zie besparing direct
- **Demo-flow** — proeven van het product
- **/proof page** — track record van besparingen (live)
- **/prijs page** — uitleg van 20% no-cure-no-pay
- **/faq** — 18 vragen in 4 categorieën
- **Live activity-feed** — recente besparingen scrollen (v15)

### Voor gebruikers (na signup)
- **Factuur OCR** — Llama 4 Scout Vision herkent provider + bedragen
- **Multi-page PDF support** — werkt voor jaarafrekeningen
- **Categorie-aware** — Telecom / Energie / Water / Verzekering / Hypotheek / Bank / Streaming / Overig
- **Gepersonaliseerde categorie-besparing (v17)** — energie/water/
  hypotheek/verzekering vergelijken op de ECHTE OCR-waarden van je
  factuur (kWh/m³-tarief, rente, dekking, eigen risico), niet op
  hardcoded marktgemiddelden. Water-blok is monopolie-bewust
  (besparing via verbruik, niet overstappen).
- **Markt-vergelijking** — 200+ providers in 8 landen (NL/BE/DE/FR/UK/US/ES/IT);
  NL water compleet (10 drinkwaterbedrijven), GYM + OV uitgebreid
- **Onderhandel-mail generator** — Llama 3.3, provider-specifieke tone
- **Multi-round counter-mails** — tot 3 rondes met AI-analyse van provider-respons
- **Bewijs-flow** — forward bevestigingsmail naar bewijs@degeldheld.com
- **Outcome tracking** — meet werkelijk bespaard bedrag
- **Dashboard** — overzicht van bills + onderhandelingen
- **Stripe paywall** — 20% fee na verifieerd succes (achter feature-flag)

### Voor admin (jij)
- **/admin/pers-mailer** — outreach tool met 20 contacten
- **/admin/value** — bedrijfswaarde-tracker
- **/admin/seed-success** — historische cases toevoegen
- **/admin/fraud** — flagged accounts review
- **/admin/training** — OCR training samples
- **/admin/providers** — provider-database beheer

### Marketing & growth
- **30 SEO-pages** — `onderhandelen-met-{provider}` + `{categorie}-besparen`
- **Referral systeem** — code, link, gratis-onderhandeling reward
- **Social share kit** — auto-PNG voor Instagram Stories
- **TikTok/Twitter ready** — `@degeldheld_` accounts actief
- **Cookie banner + AVG-pages** — /privacy, /voorwaarden, /account/delete

### Backend automatisering
- **Cron `/api/cron/outcome-followup`** — 7d na mail vraagt uitkomst
- **Cron `/api/cron/monthly-recheck`** — 30d herinnert om nieuwe factuur te uploaden
- **Cron `/api/cron/fraud-check`** — dagelijks suspicion-scores
- **Cron `/api/cron/cleanup-anonymous`** — 24u oude unclaimed bills wegen
- **Sentry alerts** — Slack/email bij errors

### Diepe integraties (klaar maar feature-flagged)
- **PSD2 bank-koppeling (Tink)** — auto-detect vaste lasten uit transactie-stream
- **WhatsApp Business inbound** — provider-antwoord via WhatsApp
- **Auto-pingpong email** — Resend inbound webhook
- **Multi-language UI** — NL/EN/DE/FR

---

## Wat NIET werkt of pending

| Wat | Waarom | Wanneer fixen |
|---|---|---|
| Sentry voor DeGeldHeld | Aangemaakt onder "alpha rader pro" Sentry-project | Vandaag (15 min) |
| Stripe live mode | Sandbox actief, niet live | Wanneer eerste echte betaling nadert |
| Apple Pay (jouw setup) | Family Sharing "Kind" account | Ouder moet upgraden naar volwassen-lid |
| Cloudflare Turnstile CAPTCHA | Geen toegang Cloudflare op moment | Na password-reset |
| Resend inbound (auto-pingpong) | Pro $20/mnd nodig voor 2e domein | Wanneer 100+ users |
| Higgsfield marketing | Apple Pay setup eerst | Morgen na verjaardag-fix |

---

## Aantal users / business-status

- **Real users**: 1 (jij)
- **Geseede demo-data op /proof**: €5.988 / 27 onderhandelingen
- **Pers-mails verzonden**: ~10 (geen reactie nog, normaal)
- **Live op productie**: Ja
- **Klaar voor TikTok-traffic**: Bijna (v15 brengt anonymous flow + activity feed)

---

## Naast DeGeldHeld

| Project | Status |
|---|---|
| **MarktSignaal Pro** (vh AlphaRadar) | Telegram trading-bot, 185 commando's, gepauzeerd |
| **Cloudflare domein**: `degeldheld.com` | Actief tot mei 2027 |

---

## Contact

Bas Heling — basheling@icloud.com · +31 6 19 03 99 28
