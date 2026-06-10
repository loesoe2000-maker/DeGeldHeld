# Verwerkingsregister (AVG art. 30)

> **CONCEPT — laat door een jurist/DPO controleren vóór productie. Dit is geen
> juridisch advies.**

Verwerkingsverantwoordelijke: **Techz B.V.**, handelend onder de naam
DeGeldHeld, Nederland, KvK 84079398.
Contact: privacy@degeldheld.com. Laatst bijgewerkt: mei 2026.

Dit register is afgeleid uit de échte codebase (`prisma/schema.prisma` + de
ingeschakelde sub-verwerkers), niet uit een template.

---

## V1 — Accountbeheer & authenticatie

- **Categorieën persoonsgegevens:** e-mailadres, naam (optioneel), login-
  sessies (`Session`), OAuth-tokens indien van toepassing (`Account`),
  voorkeuren (`notificationsEnabled`, `ocrTrainingOptIn`, `marketingOptOut`).
- **Betrokkenen:** geregistreerde gebruikers.
- **Doel:** account aanmaken, inloggen via magic-link, de dienst leveren.
- **Grondslag:** uitvoering overeenkomst (art. 6.1.b).
- **Ontvangers:** Neon (DB), Resend (magic-link e-mail), Vercel (hosting).
- **Bewaartermijn:** zolang het account bestaat; bij verwijdering onomkeerbaar
  geanonimiseerd (`app/api/account/delete`).
- **Beveiliging:** HTTPS, encryptie at-rest, JWT-sessies, rate-limiting.

## V2 — Factuuranalyse (OCR)

- **Categorieën:** geüpload beeld/PDF, uitgelezen velden (`Bill`: provider,
  categorie, bedrag(en), plan, periode, **klantnummer**, land, valuta,
  categorie-specifieke velden), ruwe OCR-tekst (`rawOcr`), beeld-hash.
- **Betrokkenen:** gebruikers + anonieme bezoekers (pre-signup).
- **Doel:** de markt vergelijken en een onderhandel-mail opstellen.
- **Grondslag:** uitvoering overeenkomst (art. 6.1.b).
- **Ontvangers:** Groq (AI/OCR — VS, SCC's), Neon (opslag), Vercel.
- **Bewaartermijn:** actieve account-levensduur; **anonieme** bills < 24 uur
  indien niet geclaimd (cron `cleanup-anonymous`). `rawOcr`/klantnummer worden
  bij accountverwijdering gewist.
- **Beveiliging:** scoped queries (per `userId`/`anonymousSessionId`),
  beeld-dedup-hash, PII-stripping in logs.

## V3 — Onderhandeling & uitkomst

- **Categorieën:** `Negotiation` (mailtekst, status, verwachte/echte
  besparing, reasoning), `NegotiationRound` (provider-antwoorden, counters),
  `OutcomeProof` (bewijs van besparing).
- **Doel:** de onderhandeling voeren + (bij no-cure-no-pay) de fee bepalen.
- **Grondslag:** uitvoering overeenkomst (art. 6.1.b).
- **Ontvangers:** Neon, Resend (in/uitgaande mail), Groq (analyse antwoord).
- **Bewaartermijn:** account-levensduur; vrije-tekstvelden gewist bij
  accountverwijdering. Geaggregeerde, niet-herleidbare besparingscijfers
  blijven voor de publieke /proof-statistiek.
- **Beveiliging:** ownership-checks op elke route; inbound-webhooks
  Svix-geverifieerd.

## V4 — Betalingen

- **Categorieën:** `Payment` (bedrag, status, Stripe-ids), `User.stripeCustomerId`.
  Kaartgegevens verwerkt **Stripe**; wij zien status + laatste 4 cijfers.
- **Doel:** de fee / het abonnement innen.
- **Grondslag:** uitvoering overeenkomst + wettelijke (fiscale) plicht.
- **Ontvangers:** Stripe.
- **Bewaartermijn:** betaalbewijs 7 jaar (fiscale bewaarplicht); overige
  velden geanonimiseerd bij accountverwijdering.
- **Beveiliging:** Stripe-webhooks met handtekening + idempotentie.

## V5 — Communicatie (transactioneel + retentie + inbound)

- **Categorieën:** e-mailadres, mailinhoud, `unsubscribeToken`,
  inbound-mails naar inbox@/bewijs@/auto@ (`WhatsAppThread/Message` voor
  WhatsApp-flow indien actief).
- **Doel:** magic-links, statusupdates, bespaar-tips/herinneringen,
  inbound factuur/-bewijs-verwerking.
- **Grondslag:** uitvoering overeenkomst (transactioneel) /
  gerechtvaardigd belang met opt-out (retentie) / toestemming (marketing-nieuwsbrief).
- **Ontvangers:** Resend (+ Twilio/360dialog alleen indien WhatsApp aanstaat).
- **Bewaartermijn:** account-levensduur; opt-out via `marketingOptOut` +
  1-klik unsubscribe.
- **Beveiliging:** verplichte send-gate (`lib/notify.ts`) met opt-out-check +
  unsubscribe-footer.

## V6 — Beveiliging, fraude & foutmonitoring

- **Categorieën:** IP/`x-forwarded-for` (rate-limiting), `FraudFlag`
  (score + reden), Sentry-foutevents (cookies/auth-headers gestript).
- **Doel:** misbruik tegengaan, fraude detecteren, fouten opsporen.
- **Grondslag:** gerechtvaardigd belang (art. 6.1.f).
- **Ontvangers:** Sentry, Cloudflare (Turnstile/edge).
- **Bewaartermijn:** Sentry kortlopend (≈30 dagen); fraud-flags zolang
  relevant, reden-tekst gewist bij accountverwijdering.
- **Beveiliging:** PII-scrub in `beforeSend`, security-headers, Turnstile.

## V7 — AI-verbetering (OCR-training) — optioneel

- **Categorieën:** `OcrTrainingSample` — **geanonimiseerde** factuurvelden
  (geen naam/IBAN/adres).
- **Doel:** de OCR-nauwkeurigheid verbeteren.
- **Grondslag:** **toestemming** (`ocrTrainingOptIn`, default uit).
- **Ontvangers:** intern + Groq.
- **Bewaartermijn:** tot intrekking toestemming; bij accountverwijdering
  ontkoppeld van de gebruiker.
- **Beveiliging:** PII-stripping bij aanmaak.

---

### Niet (meer) verwerkt

- **Hypotheek/verzekering-advies**: per v22 gated (Wft/AFM). We tonen geen
  vergelijking of advies voor die categorieën.
- **PSD2/bank-koppeling**: alleen achter feature-flag; buiten scope van dit
  register zolang uit.
