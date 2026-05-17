import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const DIRS = ["lib", "app/api", "components"];

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

function allSourceLines(): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = [];
  for (const dir of DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walkTs(abs)) {
      const lines = fs.readFileSync(file, "utf-8").split("\n");
      const rel = path.relative(ROOT, file);
      lines.forEach((text, i) => out.push({ file: rel, line: i + 1, text }));
    }
  }
  return out;
}

describe("self-review: zero of the worst smells", () => {
  const lines = allSourceLines();

  it("no `as any` casts in lib/, app/api/, components/", () => {
    const hits = lines.filter((l) => /\bas\s+any\b/.test(l.text) || /:\s*any(\b|\[)/.test(l.text));
    expect(hits.map((h) => `${h.file}:${h.line}`)).toEqual([]);
  });

  it("no `@ts-ignore` / `@ts-expect-error` without a reason on the line", () => {
    const hits = lines.filter((l) => {
      if (!/@ts-(ignore|expect-error)/.test(l.text)) return false;
      // Require a reason on the same line (at least 8 chars after the directive)
      return !/@ts-(ignore|expect-error)[^a-zA-Z]*.{8,}/.test(l.text);
    });
    expect(hits.map((h) => `${h.file}:${h.line}`)).toEqual([]);
  });

  it("no `console.log` debug residue (console.error/warn are OK)", () => {
    const hits = lines.filter((l) => /\bconsole\.log\b/.test(l.text));
    expect(hits.map((h) => `${h.file}:${h.line}`)).toEqual([]);
  });
});
