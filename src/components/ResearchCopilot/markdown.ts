/**
 * Minimal, safe markdown for Booking Assistant replies: paragraphs, bullet and numbered lists, **bold**,
 * `code` and [links](/portal-path). Output is a token tree rendered as React elements — never raw HTML —
 * and links are limited to portal paths and http(s); anything else (seed://, javascript:, …) stays plain text.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; external: boolean; children: Inline[] };

export type ListItem = { inlines: Inline[]; sub: Inline[][] };

export type Block =
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { kind: "heading"; inlines: Inline[] }
  | { kind: "rule" };

const UNSAFE_PATH = /^\/(admin|api\/|django-admin)/i;

/** A link target the chat may open, or null when it must be shown as plain text. */
export function safeHref(raw: string | null | undefined): string | null {
  const href = (raw || "").trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//") && !UNSAFE_PATH.test(href)) return href;
  return null;
}

const INLINE_SOURCE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/.source;

export function parseInline(text: string): Inline[] {
  // A fresh regex per call: parseInline recurses for bold / link text, which would reset a shared lastIndex.
  const INLINE_RE = new RegExp(INLINE_SOURCE, "g");
  const out: Inline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      out.push({ kind: "bold", children: parseInline(m[1]) });
    } else if (m[2] !== undefined) {
      out.push({ kind: "code", text: m[2] });
    } else {
      const href = safeHref(m[4]);
      const children = parseInline(m[3]);
      out.push(href ? { kind: "link", href, external: !href.startsWith("/"), children } : { kind: "text", text: m[3] });
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return mergeText(out);
}

function mergeText(items: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (it.kind === "text" && prev?.kind === "text") {
      out[out.length - 1] = { kind: "text", text: prev.text + it.text };
    } else if (!(it.kind === "text" && !it.text)) {
      out.push(it);
    }
  }
  return out;
}

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const ORDERED_RE = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING_RE = /^\s{0,3}#{1,6}\s+(.*)$/;
const RULE_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

type RawItem = { text: string; sub: string[] };

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; start: number; items: RawItem[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", lines: para.map(parseInline) });
    para = [];
  };
  const flushList = () => {
    if (list) {
      blocks.push({
        kind: "list",
        ordered: list.ordered,
        start: list.start,
        items: list.items.map((it) => ({ inlines: parseInline(it.text), sub: it.sub.map(parseInline) })),
      });
    }
    list = null;
  };

  for (const line of (text || "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (RULE_RE.test(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: "rule" });
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", inlines: parseInline(heading[1]) });
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    const ordered = bullet ? null : ORDERED_RE.exec(line);
    const indented = /^\s{2,}\S/.test(line);
    if (list && list.items.length && indented && (bullet || ordered)) {
      list.items[list.items.length - 1].sub.push(bullet ? bullet[1] : ordered![2]);
      continue;
    }
    if (bullet || ordered) {
      flushPara();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [] };
      }
      list.items.push({ text: bullet ? bullet[1] : ordered![2], sub: [] });
      continue;
    }
    if (list && list.items.length && indented) {
      const last = list.items[list.items.length - 1];
      if (last.sub.length) last.sub[last.sub.length - 1] += ` ${line.trim()}`;
      else last.text += ` ${line.trim()}`;
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}
