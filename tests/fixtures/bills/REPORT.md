# OCR fixture pass-rate

This file is auto-overwritten when the live-LLM test runs (set
`GROQ_API_KEY` to a real key). Without a live key, the suite only
validates structural integrity — text extraction + provider/amount
markers — and skips the accuracy gate.

## Structure

30 fixtures under `tests/fixtures/bills/`:
- NL telecom: 6 (KPN, Vodafone, Odido, Ziggo, Tele2, Budget Mobiel)
- NL energie: 6 (Eneco, Vattenfall, Greenchoice, NLE, Budget Energie, Coolblue Energie)
- NL verzekering: 4 (Centraal Beheer, Univé, FBTO, Achmea)
- NL bank: 4 (ABN, ING, Rabo, bunq)
- DE: 4 (Telekom, Vodafone DE, E.ON, RWE)
- UK: 3 (BT, Sky, British Gas)
- US: 3 (Verizon, AT&T, Comcast)

Each is a synthetic single-page PDF with provider, plan, period,
customer number, monthly + total amount, country marker. PII-free
by construction.

Regenerate with `npx tsx scripts/generate-ocr-fixtures.ts`.

## Pass gates (sprint v9 DEEL 4)

- Global: ≥ 75%
- NL telecom: ≥ 90%

These run only when `GROQ_API_KEY` is set to a real key. CI skips
the gate to avoid burning Groq tokens; run locally before tuning the
OCR system prompt to know whether your change improved or regressed.
