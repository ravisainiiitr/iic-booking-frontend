import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

/** Files owned by other workstreams that still have unlabelled icon buttons. */
const PENDING_FILES = new Set<string>([]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [path] : [];
  });
}

/** Opening-tag end index, skipping `>` inside JSX expressions. */
function openingTagEnd(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0 && c === ">") return i;
  }
  return -1;
}

/** Buttons whose only children are self-closing components (icons) and that have no accessible name. */
function findUnlabelledIconButtons(src: string): number[] {
  const lines: number[] = [];
  const re = /<(Button|button)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const tag = m[1];
    const end = openingTagEnd(src, m.index + tag.length + 1);
    if (end < 0 || src[end - 1] === "/") continue;
    const openTag = src.slice(m.index, end + 1);
    const close = src.indexOf(`</${tag}>`, end);
    if (close < 0) continue;
    const inner = src.slice(end + 1, close);
    if (/<(Button|button)\b/.test(inner)) continue;
    if (/aria-label(ledby)?=|\{\.\.\./.test(openTag)) continue;
    const text = inner
      .replace(/<[A-Z][\w.]*\b[^<>]*?\/>/gs, "")
      .replace(/\{\/\*.*?\*\/\}/gs, "")
      .trim();
    if (text === "" || /^\{[^}]*\?\s*\(?\s*\)?\s*:\s*\(?\s*\)?\s*\}$/.test(text)) {
      lines.push(src.slice(0, m.index).split("\n").length);
    }
  }
  return lines;
}

describe("icon-only buttons", () => {
  it("detects an unlabelled icon button and accepts a labelled one", () => {
    expect(findUnlabelledIconButtons(`<Button size="icon" onClick={() => a > b}>\n  <X className="h-4" />\n</Button>`)).toEqual([1]);
    expect(findUnlabelledIconButtons(`<Button size="icon" aria-label="Close"><X /></Button>`)).toEqual([]);
    expect(findUnlabelledIconButtons(`<Button><X /> Close</Button>`)).toEqual([]);
  });

  it("all have an accessible name", () => {
    const offenders = sourceFiles(SRC).flatMap((file) => {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      if (PENDING_FILES.has(rel)) return [];
      return findUnlabelledIconButtons(readFileSync(file, "utf8")).map((line) => `${rel}:${line}`);
    });
    expect(offenders).toEqual([]);
  });
});
