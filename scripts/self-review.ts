/**
 * scripts/self-review.ts — static smell detector.
 *
 * Walks lib/, app/api/, components/ and flags AI-typical anti-patterns:
 *   - `as any` / `: any` casts
 *   - `@ts-ignore` / `@ts-expect-error` without a reason comment
 *   - `console.log` calls (debug residue)
 *   - functions / route handlers >100 lines
 *   - `process.env.X` direct reads (should go via lib/env.ts)
 *   - hardcoded http(s) URLs in business logic
 *
 * Exit 0 = clean, 1 = findings (we still print, doesn't block tests).
 */

export {};

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const DIRS = ["lib", "app/api", "components"];

// env reads that are LEGITIMATE in source code:
// - lib/env.ts is the validator itself
// - sentry/config files have to read DSN directly
// - scripts/ live outside the audit dirs
const ENV_READ_OK_FILES = new Set<string>([
  "lib/env.ts",
  "lib/feature-flags.ts",
]);

type Finding = { file: string; line: number; kind: string; snippet: string };

function* walkTs(dir: string): IterableIterator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walkTs(full);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      yield full;
    }
  }
}

function findingsFor(file: string, src: string): Finding[] {
  const rel = path.relative(ROOT, file);
  const lines = src.split("\n");
  const out: Finding[] = [];

  // 1. any-casts
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\bas\s+any\b/.test(l) || /:\s*any(\b|\[)/.test(l)) {
      // Allow test-only any (we generally have those in mocks)
      if (rel.startsWith("tests/")) continue;
      out.push({ file: rel, line: i + 1, kind: "any-cast", snippet: l.trim() });
    }
  }

  // 2. ts-ignore / ts-expect-error without "—" or "because" reason
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/@ts-(ignore|expect-error)/.test(l)) {
      // Require a reason on the same line after the directive (—, :, because, since)
      const hasReason = /(@ts-(ignore|expect-error))[^a-zA-Z]*[a-zA-Z——].*[a-zA-Z]/.test(l);
      // Also accept a reason in the line above (within 3 chars of comment open)
      const prev = lines[i - 1] ?? "";
      const prevHasReason = /^\s*\/\/\s*.{8,}/.test(prev);
      if (!hasReason && !prevHasReason) {
        out.push({ file: rel, line: i + 1, kind: "ts-suppress-no-reason", snippet: l.trim() });
      }
    }
  }

  // 3. console.log (debug residue) — allow console.error / .warn
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\bconsole\.log\b/.test(l)) {
      out.push({ file: rel, line: i + 1, kind: "console-log", snippet: l.trim() });
    }
  }

  // 4. Big functions: simple heuristic — `function X(` or `export function X(` or `=> {`
  //    followed by >100 non-blank lines before matching brace.
  const fnRe = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(fnRe);
    if (!m) continue;
    const name = m[1] ?? m[2];
    let depth = 0;
    let bodyLines = 0;
    let opened = false;
    for (let j = i; j < lines.length; j++) {
      for (const c of lines[j]) {
        if (c === "{") {
          depth++;
          opened = true;
        } else if (c === "}") {
          depth--;
        }
      }
      if (opened) bodyLines++;
      if (opened && depth === 0) {
        if (bodyLines > 100) {
          out.push({ file: rel, line: i + 1, kind: `large-function:${name}:${bodyLines}`, snippet: lines[i].trim() });
        }
        break;
      }
    }
  }

  // 5. process.env.X reads outside the env-validator
  if (!ENV_READ_OK_FILES.has(rel)) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/\bprocess\.env\.[A-Z_]/.test(l)) {
        out.push({ file: rel, line: i + 1, kind: "raw-env-read", snippet: l.trim() });
      }
    }
  }

  // 6. Hardcoded prod URLs (lib only — components/pages OK in metadata)
  if (rel.startsWith("lib/")) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!/https?:\/\/[^\s'"`]+/.test(l)) continue;
      // Skip if line is a comment
      if (/^\s*\*|^\s*\/\//.test(l)) continue;
      // Allow standard external API endpoints — those are intentional
      if (/api\.(groq|tink|twilio|resend|stripe|uptimerobot)\.com/.test(l)) continue;
      // Allow Twilio Messages endpoint, Tink Link, wa.me share endpoint, duckduckgo search
      if (/api\.twilio\.com\/2010|link\.tink\.com|wa\.me|duckduckgo\.com/.test(l)) continue;
      // Allow brand URLs that are data (in providers.ts registry)
      if (rel === "lib/providers.ts") continue;
      // Allow localhost defaults
      if (/http:\/\/localhost/.test(l)) continue;
      out.push({ file: rel, line: i + 1, kind: "hardcoded-url", snippet: l.trim().slice(0, 90) });
    }
  }

  return out;
}

function main() {
  const all: Finding[] = [];
  for (const dir of DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walkTs(abs)) {
      const src = fs.readFileSync(file, "utf-8");
      all.push(...findingsFor(file, src));
    }
  }

  const byKind = new Map<string, number>();
  for (const f of all) byKind.set(f.kind.split(":")[0], (byKind.get(f.kind.split(":")[0]) ?? 0) + 1);

  if (all.length === 0) {
    console.log("✓ self-review: 0 findings");
    process.exit(0);
  }
  console.log(`self-review: ${all.length} findings`);
  for (const [k, n] of byKind) console.log(`  ${k.padEnd(28)} ${n}`);
  console.log("");
  for (const f of all) console.log(`  ${f.file}:${f.line}  [${f.kind}]  ${f.snippet}`);
  process.exit(1);
}

main();
