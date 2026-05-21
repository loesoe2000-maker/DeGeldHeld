# Verwerkersovereenkomsten (DPA's) — sub-verwerkers

> **CONCEPT — laat door een jurist/DPO controleren vóór productie. Dit is geen
> juridisch advies.**

DeGeldHeld schakelt onderstaande sub-verwerkers in. Voor élk geldt een
verwerkersovereenkomst (Data Processing Agreement). **Code kan geen DPA
tekenen** — dit is de checklist voor de eigenaar. Teken/accepteer de DPA bij
elke partij en vink af.

Laatst gecontroleerd (DPA-URLs via WebFetch): **2026-05-21**.

| Verwerker | Wat ze verwerken | Locatie | DPA-URL (geverifieerd) | Incorporatie / status |
|-----------|------------------|---------|------------------------|------------------------|
| **Vercel** | Hosting van de app (request/response, logs) | EU (fra1) + VS-moeder | https://vercel.com/legal/dpa ✅ | **Auto-geïncorporeerd** in de Agreement (geen aparte handtekening; SCC's inbegrepen). ☑ |
| **Stripe** | Betalingen (kaartdata, status) | EU / VS | https://stripe.com/legal/dpa ✅ | **Auto-geïncorporeerd** ("forms part of the Agreement", ssa). ☑ |
| **Resend** | Uitgaande + inbound e-mail (magic-links, transactioneel, retentie) | EU / VS | https://resend.com/legal/dpa ✅ | **Auto-geïncorporeerd** bij acceptatie ToS (handtekeningblok is "reference only"). ☑ |
| **Sentry** | Foutmonitoring (PII gestript) | EU / VS | https://sentry.io/legal/dpa/ ✅ | **Eigenaar-actie: expliciet accepteren** — vereist losse elektronische acceptatie ("Follow our instructions to enter into our DPA"). ☐ |
| **Cloudflare** | DNS, CDN, bot-bescherming (Turnstile) | EU / VS edge | https://www.cloudflare.com/cloudflare-customer-dpa/ ✅ (pagina resolve't) | **Eigenaar bevestigt/vraagt aan** — incorporatie-tekst niet schoon uitleesbaar; eigenaar controleert acceptatie. ☐ |
| **Neon** (nu Databricks) | Database: account, facturen, onderhandelingen, betalingen | EU (Frankfurt) | https://neon.com/dpa ✅ (redirect van neon.tech/dpa) | **Te verifiëren door eigenaar** — Neon is overgenomen door Databricks; `neon.com/dpa` is nu een "Product Specific Schedule" onder de Databricks MCSA. Controleer de feitelijke DPA op de Databricks legal-site. ☐ |
| **Groq** | AI/OCR-analyse van geüploade facturen | VS (SCC's) | *geen vaste DPA-URL bevestigd* (groq.com/data-processing-addendum → 404) | **Eigenaar vraagt aan** — DPA opvragen via Groq legal/support; URL niet te verifiëren deze run (niet verzonnen). ☐ |

### Los van de app (alleen indien gebruikt)
| Verwerker | Wat | DPA | Status |
|-----------|-----|-----|--------|
| **MailerLite** | Marketing-nieuwsbrief (aparte opt-in) | https://www.mailerlite.com/legal/dpa | ☐ te tekenen indien ingezet |
| **Twilio / 360dialog** | WhatsApp-flow (alleen als `WHATSAPP_ENABLED`) | resp. twilio.com / 360dialog.com legal | ☐ alleen indien actief |

## Eigenaar-actielijst (open punten)
- **Sentry** — DPA expliciet accepteren via hun proces.
- **Cloudflare** — bevestig acceptatie/incorporatie van de customer-DPA.
- **Neon/Databricks** — verifieer welke DPA na de overname geldt (Databricks
  legal) en dat 'ie van toepassing is op het Neon-account.
- **Groq** — DPA opvragen bij Groq legal/support (geen publieke DPA-URL
  bevestigd; niet verzinnen).
- **Vercel / Stripe / Resend** — auto-geïncorporeerd; geen losse handtekening
  nodig (wel bewaren als bewijs).

## Aandachtspunten voor de eigenaar
1. **VS-verwerkers** (Groq, en VS-delen van Vercel/Resend/Stripe/Cloudflare/
   Sentry): controleer dat de DPA EU-standaardcontractbepalingen (SCC's) +
   eventueel het EU-US Data Privacy Framework bevat.
2. Houd een **actuele sub-verwerkerslijst** bij; informeer betrokkenen bij een
   nieuwe sub-verwerker (staat ook in de privacyverklaring).
3. Bewaar de getekende/geaccepteerde DPA's centraal (bewijs richting AP).
4. Werk dit bestand bij zodra een DPA getekend is (zet ☐ → ☑ + datum).
5. ✅ = DPA-URL via WebFetch bevestigd op 2026-05-21; ☑ = auto-geïncorporeerd
   (geen losse actie); ☐ = open eigenaar-actie.
