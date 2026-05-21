# Verwerkersovereenkomsten (DPA's) — sub-verwerkers

> **CONCEPT — laat door een jurist/DPO controleren vóór productie. Dit is geen
> juridisch advies.**

DeGeldHeld schakelt onderstaande sub-verwerkers in. Voor élk geldt een
verwerkersovereenkomst (Data Processing Agreement). **Code kan geen DPA
tekenen** — dit is de checklist voor de eigenaar. Teken/accepteer de DPA bij
elke partij en vink af.

Laatst bijgewerkt: mei 2026.

| Verwerker | Wat ze verwerken | Locatie | Standaard-DPA | Status |
|-----------|------------------|---------|---------------|--------|
| **Vercel** | Hosting van de app (request/response, logs) | EU (fra1) + VS-moeder | https://vercel.com/legal/dpa | ☐ te tekenen |
| **Neon** | Database: account, facturen, onderhandelingen, betalingen | EU (Frankfurt) | https://neon.tech/dpa | ☐ te tekenen |
| **Resend** | Uitgaande + inbound e-mail (magic-links, transactioneel, retentie) | EU / VS | https://resend.com/legal/dpa | ☐ te tekenen |
| **Groq** | AI/OCR-analyse van geüploade facturen | VS (SCC's) | https://groq.com/ (DPA opvragen via legal/support) | ☐ te tekenen |
| **Stripe** | Betalingen (kaartdata, status) | EU / VS | https://stripe.com/legal/dpa | ☐ te tekenen |
| **Cloudflare** | DNS, CDN, bot-bescherming (Turnstile) | EU / VS edge | https://www.cloudflare.com/cloudflare-customer-dpa/ | ☐ te tekenen |
| **Sentry** | Foutmonitoring (PII gestript) | EU / VS | https://sentry.io/legal/dpa/ | ☐ te tekenen |

### Los van de app (alleen indien gebruikt)
| Verwerker | Wat | DPA | Status |
|-----------|-----|-----|--------|
| **MailerLite** | Marketing-nieuwsbrief (aparte opt-in) | https://www.mailerlite.com/legal/dpa | ☐ te tekenen indien ingezet |
| **Twilio / 360dialog** | WhatsApp-flow (alleen als `WHATSAPP_ENABLED`) | resp. twilio.com / 360dialog.com legal | ☐ alleen indien actief |

## Aandachtspunten voor de eigenaar
1. **VS-verwerkers** (Groq, en VS-delen van Vercel/Resend/Stripe/Cloudflare/
   Sentry): controleer dat de DPA EU-standaardcontractbepalingen (SCC's) +
   eventueel het EU-US Data Privacy Framework bevat.
2. Houd een **actuele sub-verwerkerslijst** bij; informeer betrokkenen bij een
   nieuwe sub-verwerker (staat ook in de privacyverklaring).
3. Bewaar de getekende/geaccepteerde DPA's centraal (bewijs richting AP).
4. Werk dit bestand bij zodra een DPA getekend is (zet ☐ → ✅ + datum).
