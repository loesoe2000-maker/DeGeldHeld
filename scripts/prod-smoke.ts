/**
 * scripts/prod-smoke.ts — v34 ASSURANCE DEEL 5.
 *
 * Probet de live productie (default https://www.degeldheld.com) op:
 *   • 12 paden: 6 V33 SEO-landings + 6 check-pages
 *   • Per pad: HTTP 200, body > 5_000 bytes, één <h1> in eerste 3 KB,
 *     <link rel="canonical"> aanwezig, og:title-meta aanwezig,
 *     <script type="application/ld+json"> aanwezig (V33-pages)
 *   • /sitemap.xml: parse + assert alle 12 paden voorkomen (de SEO-pages
 *     staan al in app/sitemap.ts; de check-pages NIET — dat is bewuste
 *     keuze. We controleren alleen dat álle paths in dit script óf in
 *     de sitemap óf via een 200-response bestaan).
 *
 * Géén interactie-tests (geen browser-emulatie); pure HTTP HEAD/GET +
 * response-body inspectie. Bedoeld als snel post-deploy signaal.
 *
 * Run:
 *   npm run smoke:v34
 *   BASE_URL=https://www.degeldheld.com npm run smoke:v34
 *   BASE_URL=http://localhost:3000 npm run smoke:v34
 *
 * Exit: 0 als alle assertions pass, 1 bij fail (dit IS een gate).
 */

const BASE = (process.env.BASE_URL ?? "https://www.degeldheld.com").replace(/\/$/, "");
const TIMEOUT_MS = 25_000;

const V33_SEO_PAGES = [
  "/box3-rechtsherstel-aanvragen-2026",
  "/huurtoeslag-2026-berekenen",
  "/zorgtoeslag-2026-misgelopen",
  "/vlucht-vertraagd-vergoeding-eu261",
  "/ns-geld-terug-vertraging",
  "/zorgkostenaftrek-aangifte-2026",
];

const CHECK_PAGES = [
  "/geld-check",
  "/box3-check",
  "/ns-check",
  "/zorgkosten-check",
  "/vluchtclaim",
  "/vind-al-je-geld",
];

type Assertion = { name: string; ok: boolean; detail: string };
type PageResult = {
  path: string;
  status: number;
  ms: number;
  bytes: number;
  contentType: string;
  assertions: Assertion[];
  pass: boolean;
};

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "manual" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function check(name: string, ok: boolean, detail: string): Assertion {
  return { name, ok, detail };
}

function indexOfH1(body: string, limit = 3_000): number {
  // Eerste <h1 in de eerste `limit` bytes — voorkomt dat een footer-h1
  // of late-rendered SPA-h1 telt als "boven-de-vouw".
  const slice = body.slice(0, limit);
  return slice.search(/<h1\b/i);
}

async function probePage(path: string, isV33Seo: boolean): Promise<PageResult> {
  const url = `${BASE}${path}`;
  const start = Date.now();
  const r = await fetchWithTimeout(url);
  const ms = Date.now() - start;
  if (!r) {
    return {
      path,
      status: 0,
      ms,
      bytes: 0,
      contentType: "",
      assertions: [check("HTTP 200", false, "network error / timeout")],
      pass: false,
    };
  }
  const body = await r.text();
  const bytes = body.length;
  const ct = r.headers.get("content-type") ?? "";
  const assertions: Assertion[] = [];

  assertions.push(check("HTTP 200", r.status === 200, `status=${r.status}`));
  assertions.push(check("body > 5 KB", bytes > 5_000, `${bytes} bytes`));
  assertions.push(check("Content-Type html", ct.includes("text/html"), ct.split(";")[0]));

  const h1Pos = indexOfH1(body);
  assertions.push(
    check("h1 in eerste 3 KB", h1Pos >= 0, h1Pos >= 0 ? `pos=${h1Pos}` : "geen <h1> in head-area"),
  );

  // canonical-link (V33 SEO + alle pagina's met metadata.alternates).
  const hasCanonical = /<link\s+[^>]*rel=["']canonical["']/i.test(body);
  assertions.push(check("canonical-link", hasCanonical, hasCanonical ? "aanwezig" : "ontbreekt"));

  // og:title — V33 pages hebben dit hard; check-pages meestal ook.
  const hasOgTitle = /<meta\s+[^>]*property=["']og:title["']/i.test(body);
  assertions.push(check("og:title", hasOgTitle, hasOgTitle ? "aanwezig" : "ontbreekt"));

  if (isV33Seo) {
    // JSON-LD is een V33-vereiste; voor check-pages niet verplicht.
    const hasJsonLd = /<script\s+[^>]*type=["']application\/ld\+json["']/i.test(body);
    assertions.push(check("JSON-LD aanwezig", hasJsonLd, hasJsonLd ? "≥ 1 script" : "geen JSON-LD"));
    // FAQPage matchen — V33 SEO-pages dragen hem allemaal.
    const hasFaqPage = /"@type"\s*:\s*"FAQPage"/i.test(body);
    assertions.push(check("FAQPage in JSON-LD", hasFaqPage, hasFaqPage ? "ja" : "nee"));
  }

  const pass = assertions.every((a) => a.ok);
  return { path, status: r.status, ms, bytes, contentType: ct, assertions, pass };
}

type SitemapResult = {
  ok: boolean;
  status: number;
  urls: string[];
  missing: string[];
  detail: string;
};

async function probeSitemap(expectedAbsolutePaths: string[]): Promise<SitemapResult> {
  const url = `${BASE}/sitemap.xml`;
  const r = await fetchWithTimeout(url);
  if (!r) {
    return { ok: false, status: 0, urls: [], missing: expectedAbsolutePaths, detail: "network error" };
  }
  const body = await r.text();
  if (r.status !== 200) {
    return { ok: false, status: r.status, urls: [], missing: expectedAbsolutePaths, detail: `status ${r.status}` };
  }
  // Heel-simpele XML-parser — <loc>https://…</loc> matchen.
  const urls: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) urls.push(m[1]);
  const missing = expectedAbsolutePaths.filter((p) => !urls.some((u) => u.endsWith(p)));
  return {
    ok: missing.length === 0,
    status: r.status,
    urls,
    missing,
    detail: `${urls.length} <loc>-entries`,
  };
}

function renderTable(results: PageResult[], sitemap: SitemapResult): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("═".repeat(78));
  lines.push("V34 PROD-SMOKE — degeldheld.com response-shape probes");
  lines.push(`Target: ${BASE}`);
  lines.push(`Datum:  ${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
  lines.push("═".repeat(78));
  lines.push("");
  lines.push("Pages:");
  for (const r of results) {
    const icon = r.pass ? "✓" : "✗";
    lines.push(
      `${icon} ${r.path.padEnd(42)} ${String(r.status).padStart(3)}  ${String(r.bytes).padStart(6)}B  ${String(r.ms).padStart(4)}ms`,
    );
    for (const a of r.assertions) {
      if (!a.ok) lines.push(`   ✗ ${a.name} — ${a.detail}`);
    }
  }
  lines.push("");
  lines.push("Sitemap:");
  const icon = sitemap.ok ? "✓" : "✗";
  lines.push(`${icon} /sitemap.xml — ${sitemap.detail}`);
  if (sitemap.missing.length > 0) {
    lines.push(`   ✗ missing in <loc>: ${sitemap.missing.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const allPages = [
    ...V33_SEO_PAGES.map((p) => ({ p, seo: true })),
    ...CHECK_PAGES.map((p) => ({ p, seo: false })),
  ];

  const results: PageResult[] = [];
  // Sequentieel om CDN rate-limits niet te raken op prod.
  for (const { p, seo } of allPages) {
    results.push(await probePage(p, seo));
  }

  // Sitemap moet alle V33 SEO-paden bevatten. De check-pages staan
  // bewust NIET in de sitemap (alleen V33-pages waren V33-doel) — we
  // verifiëren dus alleen V33 SEO-paths in <loc>.
  const sitemap = await probeSitemap(V33_SEO_PAGES);

  console.log(renderTable(results, sitemap));

  const failed = results.filter((r) => !r.pass);
  const total = results.length;
  const ok = total - failed.length;
  const sitemapStatus = sitemap.ok ? "PASS" : "FAIL";
  console.log("─".repeat(78));
  console.log(`Pages: ${ok}/${total} pass · Sitemap: ${sitemapStatus}`);
  console.log("─".repeat(78));

  if (failed.length > 0 || !sitemap.ok) {
    process.exit(1);
  }
  process.exit(0);
}

void main();
