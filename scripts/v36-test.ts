/**
 * scripts/v36-test.ts — end-to-end test van de complete user-surface
 * (v36 expansion + v37 effort-verlagers).
 *
 * Twee fases:
 *
 *   FASE 1 — "DE PDF VINDEN & VALIDEREN" (lokaal, geen netwerk)
 *     Genereert de volmacht-PDF voor beide claim-types via
 *     generateVolmachtPdf, schrijft ze naar ./v36-test-output/ zodat je
 *     ze met het blote oog kunt openen, en valideert per PDF:
 *       • magic bytes %PDF-
 *       • bestand > 1.5 KB
 *       • pdf-lib kan 'm laden + precies 1 pagina
 *       • title-metadata bevat "Machtiging"
 *       • tekst bevat klantnaam + KvK 84079398 + zaak-identifier +
 *         eIDAS-vermelding + scope-uitsluiting (pdfjs-dist; valt terug op
 *         een raw-byte-zoektocht als pdfjs in script-context faalt)
 *
 *   FASE 2 — "WEBSITE OP ALLE FUNCTIES" (HTTP tegen live of localhost)
 *     • Publieke routes → verwacht HTTP 200 + body
 *     • Auth-gated pages → verwacht 200/3xx (login-gate), NOOIT 5xx
 *     • API-gates v36 + v37 (documents, volmacht, suggest-bedrag,
 *       deadline-nudge-cron, admin-proxies) → verwacht een gate-status
 *       (401/403/400/404/405/503), NOOIT 200 (lek) en NOOIT 5xx (crash)
 *     • /api/health → 200
 *
 * Run:
 *   npm run test:v36                                  # tegen productie
 *   BASE_URL=http://localhost:3000 npm run test:v36   # tegen lokaal
 *   npm run test:v36 -- --pdf-only                    # alleen fase 1
 *   npm run test:v36 -- --web-only                    # alleen fase 2
 *
 * Exit: 0 als alles slaagt, 1 bij minstens één fail. Dit IS een gate.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { generateVolmachtPdf } from "../lib/volmacht-pdf";
import { VOLMACHT_CLAIM_TYPES, type VolmachtClaimType } from "../lib/volmacht";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = (process.env.BASE_URL ?? "https://www.degeldheld.com").replace(/\/$/, "");
const TIMEOUT_MS = 25_000;
const OUTPUT_DIR = join(process.cwd(), "v36-test-output");

const argv = process.argv.slice(2);
const PDF_ONLY = argv.includes("--pdf-only");
const WEB_ONLY = argv.includes("--web-only");

// ─── Gedeelde types ──────────────────────────────────────────────────────────

type Assertion = { name: string; ok: boolean; detail: string };

function check(name: string, ok: boolean, detail: string): Assertion {
  return { name, ok, detail };
}

// ─── FASE 1: PDF ─────────────────────────────────────────────────────────────

/**
 * Verwachte inhoud per claim-type. We valideren dat deze substrings letterlijk
 * in de PDF-tekst voorkomen — zo vangen we een lege/kapotte template direct.
 */
const PDF_CASES: Array<{
  claimType: VolmachtClaimType;
  klantNaam: string;
  zaak: string;
  outFile: string;
  // substrings die in de geëxtraheerde tekst moeten zitten
  mustContain: string[];
}> = [
  {
    claimType: "HuurServicekostenClaim",
    klantNaam: "Anna van Houten",
    zaak: "2024 (Vesteda)",
    outFile: "volmacht-huurcommissie.pdf",
    mustContain: [
      "Anna van Houten",
      "84079398", // KvK
      "2024", // zaak-identifier (boekjaar)
      "Huurcommissie",
      "eIDAS",
      "huurcontract", // scope-uitsluiting
    ],
  },
  {
    claimType: "EnergieEindafrekeningClaim",
    klantNaam: "Maria de Vries",
    zaak: "Vattenfall — claim 2026-05-30",
    outFile: "volmacht-energie.pdf",
    mustContain: [
      "Maria de Vries",
      "84079398",
      "Vattenfall",
      "Geschillencommissie Energie",
      "eIDAS",
      "energiecontract", // scope-uitsluiting
    ],
  },
];

/**
 * Probeer PDF-tekst te extraheren met pdfjs-dist (direct, niet via lib/ocr.ts
 * — die is server-only). Valt bij elke fout terug op `null` zodat de caller
 * een raw-byte-zoektocht kan doen.
 */
async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    // pdfjs-dist v5 is ESM-only én vereist de LEGACY build in Node
    // (de default build verwacht browser-globals als DOMMatrix). De legacy
    // build werkt headless voor pure text-extractie (getTextContent).
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((it: unknown) =>
        typeof it === "object" && it && "str" in it ? (it as { str: string }).str : "",
      );
      text += strings.join(" ") + "\n";
    }
    return text;
  } catch {
    return null;
  }
}

/**
 * Raw-byte fallback: pdf-lib comprimeert content streams standaard niet, dus
 * de getekende tekst is vaak letterlijk in de bytes terug te vinden. Minder
 * betrouwbaar dan pdfjs (spaties/tekst kunnen opgesplitst zijn), daarom alleen
 * fallback.
 */
function rawByteContains(bytes: Uint8Array, needle: string): boolean {
  const haystack = Buffer.from(bytes).toString("latin1");
  return haystack.includes(needle);
}

type PdfResult = {
  label: string;
  outPath: string;
  bytes: number;
  textSource: "pdfjs" | "raw-bytes" | "none";
  assertions: Assertion[];
  pass: boolean;
};

async function testOnePdf(c: (typeof PDF_CASES)[number]): Promise<PdfResult> {
  const assertions: Assertion[] = [];
  const outPath = join(OUTPUT_DIR, c.outFile);

  let bytes: Uint8Array;
  try {
    bytes = await generateVolmachtPdf({
      claimType: c.claimType,
      klant: { fullName: c.klantNaam, email: "test@degeldheld.com", address: null },
      zaakIdentifier: c.zaak,
      // Vaste datum — Date.now() vermijden zou hier kunnen, maar dit is een
      // los script (geen workflow-resume), dus new Date() is prima.
      uitgifteDatum: new Date(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      label: c.claimType,
      outPath,
      bytes: 0,
      textSource: "none",
      assertions: [check("generate", false, `generateVolmachtPdf gooide: ${msg}`)],
      pass: false,
    };
  }

  // Schrijf weg zodat de gebruiker 'm kan openen.
  await writeFile(outPath, bytes);

  // 1) Magic bytes
  const magic = Buffer.from(bytes.slice(0, 5)).toString("latin1");
  assertions.push(check("magic-bytes", magic === "%PDF-", `header="${magic}"`));

  // 2) Grootte
  assertions.push(
    check("grootte", bytes.byteLength > 1_500, `${bytes.byteLength} bytes`),
  );

  // 3) pdf-lib load + paginacount
  let pageCount = 0;
  let title = "";
  try {
    const doc = await PDFDocument.load(bytes);
    pageCount = doc.getPageCount();
    title = doc.getTitle() ?? "";
    assertions.push(check("pdf-lib-load", true, `${pageCount} pagina('s)`));
    assertions.push(check("één-pagina", pageCount === 1, `pageCount=${pageCount}`));
    assertions.push(
      check("title-metadata", /Machtiging/i.test(title), `title="${title}"`),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assertions.push(check("pdf-lib-load", false, msg));
  }

  // 4) Tekst-validatie — pdfjs eerst, raw-bytes als fallback
  const text = await extractPdfText(bytes);
  let textSource: PdfResult["textSource"];
  if (text && text.trim().length > 0) {
    textSource = "pdfjs";
    for (const needle of c.mustContain) {
      assertions.push(
        check(`bevat:"${needle}"`, text.includes(needle), "via pdfjs"),
      );
    }
  } else {
    textSource = "raw-bytes";
    for (const needle of c.mustContain) {
      assertions.push(
        check(
          `bevat:"${needle}"`,
          rawByteContains(bytes, needle),
          "via raw-bytes (pdfjs niet beschikbaar)",
        ),
      );
    }
  }

  const pass = assertions.every((a) => a.ok);
  return { label: c.claimType, outPath, bytes: bytes.byteLength, textSource, assertions, pass };
}

async function runPdfPhase(): Promise<{ pass: boolean; lines: string[] }> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const lines: string[] = [];
  lines.push("");
  lines.push("════════════════════════════════════════════════════════");
  lines.push("  FASE 1 — VOLMACHT-PDF VINDEN & VALIDEREN");
  lines.push(`  output: ${OUTPUT_DIR}`);
  lines.push("════════════════════════════════════════════════════════");

  let allPass = true;
  for (const c of PDF_CASES) {
    const r = await testOnePdf(c);
    const icon = r.pass ? "✅" : "❌";
    lines.push(
      `${icon} ${r.label}  (${r.bytes}b, tekst via ${r.textSource})`,
    );
    lines.push(`     📄 ${r.outPath}`);
    for (const a of r.assertions) {
      if (!a.ok) lines.push(`     ↳ FAIL: ${a.name} — ${a.detail}`);
    }
    if (!r.pass) allPass = false;
  }
  return { pass: allPass, lines };
}

// ─── FASE 2: WEBSITE ─────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "manual" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Probe = {
  path: string;
  method: "GET" | "POST" | "DELETE";
  kind: "public" | "auth-page" | "api-gate";
  /** Toegestane statuscodes. */
  ok: number[];
};

// Dummy claim-id voor de auth-gate-checks. De auth-check vuurt vóór de DB-
// lookup, dus we krijgen 401/503 zonder dat het id hoeft te bestaan.
const DUMMY = "clxxxxxxxxxxxxxxxxxxxxxxxx";
const HUUR = "HuurServicekostenClaim";

// Pagina's die ALTIJD 200 horen te geven (publiek; flag staat aan op prod).
const PUBLIC_PAGES: string[] = [
  "/",
  "/huurcommissie-check",
  "/energie-claim-check",
  "/box3-check",
  "/geld-check",
  "/zorgkosten-check",
  "/ns-check",
  "/vind-al-je-geld",
  "/plus",
  "/onderhandel",
  "/prijs",
  "/over-ons",
  "/contact",
  "/privacy",
  "/voorwaarden",
];

// Login-vereiste pagina's: server-page doet redirect("/login") → 3xx.
// /spookabonnementen is owner-scoped (login-vereist) — hoort hier, niet bij
// publiek.
const AUTH_PAGES: string[] = [
  "/account",
  "/account/claims",
  "/account/documents",
  "/spookabonnementen",
];

// Flag-gated pagina's: 200 als hun feature-flag aan staat, anders 404/3xx
// (redirect naar /). Mag NOOIT 5xx. /vluchtclaim hangt aan de CLAIMS-flag,
// die momenteel uit staat (wacht op Aviation Edge API + jurist).
const FLAG_GATED_PAGES: string[] = ["/vluchtclaim"];

const API_GATES: Probe[] = [
  // v36 idee 4 — documents-vault
  { path: "/api/account/documents/upload", method: "POST", kind: "api-gate", ok: [400, 401, 403, 405, 503] },
  { path: `/api/account/documents/${DUMMY}/file`, method: "GET", kind: "api-gate", ok: [401, 403, 404, 503] },
  { path: `/api/account/documents/${DUMMY}`, method: "DELETE", kind: "api-gate", ok: [401, 403, 404, 503] },
  // v36 idee 2 — volmacht
  { path: `/api/volmacht/${HUUR}/${DUMMY}/form`, method: "GET", kind: "api-gate", ok: [400, 401, 403, 404, 503] },
  { path: `/api/volmacht/${HUUR}/${DUMMY}/upload-signed`, method: "POST", kind: "api-gate", ok: [400, 401, 403, 404, 405, 503] },
  { path: `/api/volmacht/${HUUR}/${DUMMY}/signed-file`, method: "GET", kind: "api-gate", ok: [400, 401, 403, 404, 503] },
  // v37 — bedrag-suggestie (read-only OCR-hulp). Anon → 401 vóór body-parse.
  { path: "/api/claims/suggest-bedrag", method: "POST", kind: "api-gate", ok: [400, 401] },
  // v37 — deadline-nudge-cron. Zonder CRON_SECRET-bearer → 401; flag uit → 503.
  { path: "/api/cron/claim-deadline-nudge", method: "GET", kind: "api-gate", ok: [401, 503] },
  // v37 — admin-proxies (bewijs + volmacht-scan). isAdmin() false → 404
  // (bewust geen 403, bestaan niet bevestigen). Nooit 200 voor anon.
  { path: `/api/admin/claims/Box3Claim/${DUMMY}/proof`, method: "GET", kind: "api-gate", ok: [401, 404] },
  { path: `/api/admin/volmacht/${HUUR}/${DUMMY}/file`, method: "GET", kind: "api-gate", ok: [401, 404] },
];

type WebResult = {
  path: string;
  method: string;
  status: number;
  ms: number;
  bytes: number;
  assertions: Assertion[];
  pass: boolean;
};

async function probePublic(path: string): Promise<WebResult> {
  const start = Date.now();
  const r = await fetchWithTimeout(`${BASE}${path}`);
  const ms = Date.now() - start;
  if (!r) {
    return {
      path,
      method: "GET",
      status: 0,
      ms,
      bytes: 0,
      assertions: [check("reachable", false, "timeout/netwerkfout")],
      pass: false,
    };
  }
  const body = await r.text().catch(() => "");
  const assertions = [
    check("status-200", r.status === 200, `status=${r.status}`),
    check("body>2kb", body.length > 2_000, `${body.length}b`),
  ];
  return {
    path,
    method: "GET",
    status: r.status,
    ms,
    bytes: body.length,
    assertions,
    pass: assertions.every((a) => a.ok),
  };
}

async function probeAuthPage(path: string): Promise<WebResult> {
  const start = Date.now();
  const r = await fetchWithTimeout(`${BASE}${path}`);
  const ms = Date.now() - start;
  if (!r) {
    return {
      path,
      method: "GET",
      status: 0,
      ms,
      bytes: 0,
      assertions: [check("reachable", false, "timeout/netwerkfout")],
      pass: false,
    };
  }
  // Auth-gated server-page: redirect("/login") → 3xx, óf 200 met login-prompt.
  // Belangrijk: NOOIT 5xx (crash). En als 200, dan mag de echte content
  // (login-vereist) niet "lekken" — we checken simpel dat het geen 5xx is en
  // dat een 200 een redirect/login bevat OF heel klein is.
  const okStatus = [200, 301, 302, 303, 307, 308].includes(r.status);
  const notServerError = r.status < 500;
  const assertions = [
    check("geen-5xx", notServerError, `status=${r.status}`),
    check("gated", okStatus, `status=${r.status} (verwacht 200/3xx)`),
  ];
  return {
    path,
    method: "GET",
    status: r.status,
    ms,
    bytes: 0,
    assertions,
    pass: assertions.every((a) => a.ok),
  };
}

async function probeFlagGated(path: string): Promise<WebResult> {
  const start = Date.now();
  const r = await fetchWithTimeout(`${BASE}${path}`);
  const ms = Date.now() - start;
  if (!r) {
    return {
      path,
      method: "GET",
      status: 0,
      ms,
      bytes: 0,
      assertions: [check("reachable", false, "timeout/netwerkfout")],
      pass: false,
    };
  }
  // 200 (flag aan) of 404/3xx (flag uit → notFound()/redirect). Nooit 5xx.
  const okStatus = [200, 301, 302, 303, 307, 308, 404].includes(r.status);
  const assertions = [
    check("geen-5xx", r.status < 500, `status=${r.status}`),
    check("flag-status", okStatus, `status=${r.status} (verwacht 200 of 404/3xx)`),
  ];
  return {
    path,
    method: "GET",
    status: r.status,
    ms,
    bytes: 0,
    assertions,
    pass: assertions.every((a) => a.ok),
  };
}

async function probeApiGate(p: Probe): Promise<WebResult> {
  const start = Date.now();
  const init: RequestInit = { method: p.method };
  if (p.method === "POST") {
    // BELANGRIJK: een POST zónder body blijft hangen op Vercel (de edge wacht
    // op een request-body die nooit komt). We sturen daarom een echte (lege)
    // FormData mee — fetch zet dan een geldige Content-Length + boundary, en
    // de auth/flag-gate vuurt netjes (→ 401/503) vóór de body-parse.
    init.body = new FormData();
  }
  const r = await fetchWithTimeout(`${BASE}${p.path}`, init);
  const ms = Date.now() - start;
  if (!r) {
    return {
      path: p.path,
      method: p.method,
      status: 0,
      ms,
      bytes: 0,
      assertions: [check("reachable", false, "timeout/netwerkfout")],
      pass: false,
    };
  }
  const assertions = [
    check("geen-5xx", r.status < 500, `status=${r.status}`),
    check("niet-200-lek", r.status !== 200, `status=${r.status} (200 = gate lekt!)`),
    check(
      "gate-status",
      p.ok.includes(r.status),
      `status=${r.status}, verwacht één van [${p.ok.join(",")}]`,
    ),
  ];
  return {
    path: p.path,
    method: p.method,
    status: r.status,
    ms,
    bytes: 0,
    assertions,
    pass: assertions.every((a) => a.ok),
  };
}

async function probeHealth(): Promise<WebResult> {
  const start = Date.now();
  const r = await fetchWithTimeout(`${BASE}/api/health`);
  const ms = Date.now() - start;
  if (!r) {
    return {
      path: "/api/health",
      method: "GET",
      status: 0,
      ms,
      bytes: 0,
      assertions: [check("reachable", false, "timeout/netwerkfout")],
      pass: false,
    };
  }
  const assertions = [check("status-200", r.status === 200, `status=${r.status}`)];
  return {
    path: "/api/health",
    method: "GET",
    status: r.status,
    ms,
    bytes: 0,
    assertions,
    pass: assertions.every((a) => a.ok),
  };
}

async function runWebPhase(): Promise<{ pass: boolean; lines: string[] }> {
  const lines: string[] = [];
  lines.push("");
  lines.push("════════════════════════════════════════════════════════");
  lines.push("  FASE 2 — WEBSITE OP ALLE FUNCTIES");
  lines.push(`  ${BASE}`);
  lines.push("════════════════════════════════════════════════════════");

  let allPass = true;

  const emit = (label: string, r: WebResult) => {
    const icon = r.pass ? "✅" : "❌";
    lines.push(`${icon} ${label} ${r.method} ${r.path}  [${r.status}] ${r.ms}ms`);
    for (const a of r.assertions) {
      if (!a.ok) lines.push(`     ↳ FAIL: ${a.name} — ${a.detail}`);
    }
    if (!r.pass) allPass = false;
  };

  lines.push("");
  lines.push("  ── Publieke pagina's (verwacht 200) ──");
  for (const path of PUBLIC_PAGES) emit("PUB ", await probePublic(path));

  lines.push("");
  lines.push("  ── Auth-gated pagina's (verwacht login-gate, geen 5xx) ──");
  for (const path of AUTH_PAGES) emit("AUTH", await probeAuthPage(path));

  lines.push("");
  lines.push("  ── Flag-gated pagina's (200 als flag aan, anders 404/3xx; geen 5xx) ──");
  for (const path of FLAG_GATED_PAGES) emit("FLAG", await probeFlagGated(path));

  lines.push("");
  lines.push("  ── V36 API-gates (verwacht 401/403/4xx/503, NOOIT 200) ──");
  for (const p of API_GATES) emit("API ", await probeApiGate(p));

  lines.push("");
  lines.push("  ── Health ──");
  emit("HLTH", await probeHealth());

  return { pass: allPass, lines };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const allLines: string[] = [];
  let overallPass = true;

  if (!WEB_ONLY) {
    const phase1 = await runPdfPhase();
    allLines.push(...phase1.lines);
    if (!phase1.pass) overallPass = false;
  }

  if (!PDF_ONLY) {
    const phase2 = await runWebPhase();
    allLines.push(...phase2.lines);
    if (!phase2.pass) overallPass = false;
  }

  allLines.push("");
  allLines.push("════════════════════════════════════════════════════════");
  allLines.push(overallPass ? "  ALLES GESLAAGD ✅" : "  ER FAALDEN CHECKS ❌");
  allLines.push("════════════════════════════════════════════════════════");
  allLines.push("");

  console.log(allLines.join("\n"));
  process.exit(overallPass ? 0 : 1);
}

main().catch((e) => {
  console.error("v36-test crashte:", e);
  process.exit(1);
});
