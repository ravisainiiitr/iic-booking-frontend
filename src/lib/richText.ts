import DOMPurify from "dompurify";

/**
 * OIC-formatted text (e.g. the equipment important instruction).
 *
 * Stored as a small HTML subset; colours are palette tokens (`var(--rt-red)`) whose light/dark shades
 * live in `index.css`. Legacy plain text is rendered with its line breaks. Mirrors the backend
 * sanitizer in `iic_booking/equipment/rich_text.py`.
 */

export const TEXT_COLORS = ["red", "orange", "amber", "green", "blue", "purple", "pink", "gray"] as const;
export const HIGHLIGHT_COLORS = ["yellow", "orange", "green", "blue", "pink"] as const;
export const RICH_TEXT_PLAIN_MAX_LENGTH = 5000;

/** Curated system font stacks; the stacks themselves are the `--rt-font-*` vars in `index.css`. */
export const FONT_FAMILIES = [
  { name: "sans", label: "Sans-serif" },
  { name: "serif", label: "Serif" },
  { name: "mono", label: "Monospace" },
  { name: "verdana", label: "Verdana" },
  { name: "tahoma", label: "Tahoma" },
  { name: "trebuchet", label: "Trebuchet MS" },
  { name: "georgia", label: "Georgia" },
  { name: "garamond", label: "Garamond" },
  { name: "courier", label: "Courier New" },
  { name: "devanagari", label: "Hindi (Devanagari)" },
] as const;

/** Point sizes offered by the editor; 11 is the note's normal text size (`--rt-size-*` in `index.css`). */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36] as const;
export const NORMAL_FONT_SIZE = 11;
const SIZE_KEYWORDS: Record<string, number> = {
  "xx-small": 7, "x-small": 7.5, small: 10, medium: 12, large: 13.5, "x-large": 18, "xx-large": 24,
};

export const textColorToken = (name: string) => `var(--rt-${name})`;
export const highlightColorToken = (name: string) => `var(--rt-hl-${name})`;
export const fontFamilyToken = (name: string) => `var(--rt-font-${name})`;
export const sizeToken = (points: number) => `var(--rt-size-${points})`;

const FONT_NAMES = new Set<string>(FONT_FAMILIES.map((f) => f.name));
const fontAliases = (names: string[], font: string) => Object.fromEntries(names.map((n) => [n, font]));
/** Fonts commonly pasted from Word / Google Docs (or chosen in the older toolbar) → nearest allowed font. */
const FONT_ALIASES: Record<string, string> = {
  ...fontAliases(["arial", "helvetica", "helvetica neue", "arial nova", "calibri", "carlito", "aptos", "segoe ui",
    "roboto", "open sans", "lato", "noto sans", "liberation sans", "sans-serif", "system-ui"], "sans"),
  ...fontAliases(["times new roman", "times", "cambria", "caladea", "book antiqua", "palatino linotype", "palatino",
    "constantia", "noto serif", "liberation serif", "serif"], "serif"),
  ...fontAliases(["consolas", "monaco", "menlo", "lucida console", "cascadia code", "roboto mono", "source code pro",
    "ui-monospace", "monospace"], "mono"),
  ...fontAliases(["courier new", "courier", "liberation mono"], "courier"),
  ...fontAliases(["verdana", "geneva"], "verdana"),
  tahoma: "tahoma",
  ...fontAliases(["trebuchet ms", "trebuchet"], "trebuchet"),
  georgia: "georgia",
  ...fontAliases(["garamond", "eb garamond", "adobe garamond pro"], "garamond"),
  ...fontAliases(["mangal", "nirmala ui", "kokila", "aparajita", "utsaah", "noto sans devanagari",
    "kohinoor devanagari"], "devanagari"),
};

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h3", "h4", "span", "a", "mark", "sub", "sup",
];
const STYLE_PROPS_BY_TAG: Record<string, string[]> = {
  span: ["color", "font-family", "font-size"],
  mark: ["background-color"],
  p: ["text-align"],
  h3: ["text-align"],
  h4: ["text-align"],
  li: ["text-align"],
};
const TEXT_ALIGNS = new Set(["center", "right"]);
const TAG_RENAMES: Record<string, string> = {
  div: "p", h1: "h3", h2: "h3", h5: "h4", h6: "h4", blockquote: "p",
  strike: "s", del: "s", ins: "u", font: "span", b: "strong", i: "em",
};
const DROP_CONTENT_TAGS = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "title", "head"]);
const BLOCK_TAGS = new Set(["p", "h3", "h4", "li"]);
const RICH_TAG = /<\/?(p|div|span|br|b|strong|i|em|u|s|strike|font|ul|ol|li|h[1-6]|blockquote|a|mark|sub|sup)\b/i;
const VAR_TOKEN = /^var\(\s*--rt-(hl-)?([a-z]+)\s*(,[^)]*)?\)$/;
const FONT_TOKEN = /^var\(\s*--rt-font-([a-z]+)\s*\)$/;
const SIZE_TOKEN = /^var\(\s*--rt-size-(\d{1,2})\s*\)$/;
const SIZE_VALUE = /^(\d{1,3}(?:\.\d+)?)\s*(pt|px|em|rem|%)$/;
const SCRIPT_STYLE = /vertical-align\s*:\s*(super|sub)\b/i;
const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i;

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0], white: [255, 255, 255], gray: [128, 128, 128], grey: [128, 128, 128],
  red: [255, 0, 0], darkred: [139, 0, 0], orange: [255, 165, 0], yellow: [255, 255, 0],
  gold: [255, 215, 0], green: [0, 128, 0], lime: [0, 255, 0], darkgreen: [0, 100, 0],
  blue: [0, 0, 255], navy: [0, 0, 128], darkblue: [0, 0, 139], teal: [0, 128, 128],
  cyan: [0, 255, 255], purple: [128, 0, 128], violet: [238, 130, 238], magenta: [255, 0, 255],
  pink: [255, 192, 203], brown: [165, 42, 42], maroon: [128, 0, 0],
};
const TEXT_HUES: [number, string][] = [
  [15, "red"], [40, "orange"], [70, "amber"], [170, "green"], [255, "blue"], [290, "purple"], [345, "pink"], [361, "red"],
];
const HIGHLIGHT_HUES: [number, string][] = [
  [15, "pink"], [40, "orange"], [75, "yellow"], [170, "green"], [290, "blue"], [361, "pink"],
];

/** True when the value is HTML from the editor (or the older formatting toolbar) rather than plain text. */
export function looksLikeRichHtml(value: string | null | undefined): boolean {
  return !!value && RICH_TAG.test(value);
}

function parseRgb(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (rgb) {
    if (rgb[4] !== undefined) {
      const alpha = parseFloat(rgb[4]) / (rgb[4].endsWith("%") ? 100 : 1);
      if (alpha < 0.15) return null;
    }
    return [1, 2, 3].map((i) => Math.min(255, parseInt(rgb[i], 10))) as [number, number, number];
  }
  return null;
}

function rgbToHls([r, g, b]: [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, l, 0];
  const d = max - min;
  const s = l <= 0.5 ? d / (max + min) : d / (2 - max - min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [((h * 60) + 360) % 360, l, s];
}

/** Canonical palette token for a colour; arbitrary colours snap to the nearest hue, black/white are dropped. */
export function paletteColor(value: string, kind: "text" | "highlight"): string | null {
  const palette: readonly string[] = kind === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const token = kind === "text" ? textColorToken : highlightColorToken;
  const v = (value || "").trim().toLowerCase().replace("!important", "").trim();
  const m = VAR_TOKEN.exec(v);
  if (m) {
    const isHighlight = Boolean(m[1]);
    return isHighlight === (kind !== "text") && palette.includes(m[2]) ? token(m[2]) : null;
  }
  const rgb = parseRgb(v);
  if (!rgb) return null;
  const [hue, lightness, sat] = rgbToHls(rgb);
  if (sat < 0.25 || lightness < 0.1 || lightness > 0.95) {
    return kind === "text" && lightness >= 0.3 && lightness <= 0.7 ? textColorToken("gray") : null;
  }
  const buckets = kind === "text" ? TEXT_HUES : HIGHLIGHT_HUES;
  const name = buckets.find(([upper]) => hue < upper)?.[1] ?? buckets[0][1];
  return token(name);
}

/** `var(--rt-font-…)` for an allowed font token or a known font name in a stack; otherwise null. */
export function fontToken(value: string): string | null {
  const v = (value || "").trim().toLowerCase().replace("!important", "").trim();
  const m = FONT_TOKEN.exec(v);
  if (m) return FONT_NAMES.has(m[1]) ? fontFamilyToken(m[1]) : null;
  for (const name of v.split(",")) {
    const alias = FONT_ALIASES[name.trim().replace(/^['"]+|['"]+$/g, "").trim()];
    if (alias) return fontFamilyToken(alias);
  }
  return null;
}

/** `var(--rt-size-N)` for an allowed size token, or a pasted size snapped to the nearest allowed point size. */
export function fontSizeToken(value: string): string | null {
  const v = (value || "").trim().toLowerCase().replace("!important", "").trim();
  const token = SIZE_TOKEN.exec(v);
  if (token) {
    const n = Number(token[1]);
    return (FONT_SIZES as readonly number[]).includes(n) ? sizeToken(n) : null;
  }
  let points: number;
  if (v in SIZE_KEYWORDS) points = SIZE_KEYWORDS[v];
  else {
    const m = SIZE_VALUE.exec(v);
    if (!m) return null;
    const n = Number(m[1]);
    const perUnit: Record<string, number> = { pt: 1, px: 0.75, rem: 12, em: NORMAL_FONT_SIZE, "%": NORMAL_FONT_SIZE / 100 };
    points = n * perUnit[m[2]];
  }
  if (!(points >= 6 && points <= 72)) return null;
  const nearest = FONT_SIZES.reduce((best, size) => (Math.abs(size - points) < Math.abs(best - points) ? size : best));
  return sizeToken(nearest);
}

/** The point size in a stored `var(--rt-size-N)` token, or null. */
export function pointsFromSizeToken(value: string | null | undefined): number | null {
  const m = SIZE_TOKEN.exec((value || "").trim());
  return m ? Number(m[1]) : null;
}

function styleDecls(raw: string): [string, string][] {
  return (raw || "")
    .split(";")
    .map((decl) => {
      const idx = decl.indexOf(":");
      return idx < 0 ? null : ([decl.slice(0, idx).trim().toLowerCase(), decl.slice(idx + 1).trim()] as [string, string]);
    })
    .filter((d): d is [string, string] => d !== null);
}

function styleValue(raw: string, ...props: string[]): string {
  let found = "";
  for (const [prop, value] of styleDecls(raw)) if (props.includes(prop)) found = value;
  return found;
}

/** Keep only palette colours, allowed fonts and sizes (span/mark) and centre/right alignment (blocks). */
export function cleanStyle(tag: string, raw: string): string {
  const allowed = STYLE_PROPS_BY_TAG[tag] ?? [];
  const kept = new Map<string, string>();
  for (const [rawProp, value] of styleDecls(raw)) {
    const prop = rawProp === "background" ? "background-color" : rawProp;
    if (!allowed.includes(prop) || value.length > 200) continue;
    let token: string | null;
    if (prop === "color") token = paletteColor(value, "text");
    else if (prop === "font-family") token = fontToken(value);
    else if (prop === "font-size") token = fontSizeToken(value);
    else if (prop === "background-color") token = paletteColor(value, "highlight");
    else token = TEXT_ALIGNS.has(value.toLowerCase()) ? value.toLowerCase() : null;
    if (token) kept.set(prop, token);
  }
  return Array.from(kept, ([k, v]) => `${k}: ${v}`).join("; ");
}

function inlineMarksFromStyle(raw: string): string[] {
  const marks: string[] = [];
  for (const [prop, value] of styleDecls(raw)) {
    const v = value.toLowerCase();
    if (prop === "font-weight" && (v === "bold" || v === "bolder" || (/^\d+$/.test(v) && Number(v) >= 600))) marks.push("strong");
    else if (prop === "font-style" && (v === "italic" || v === "oblique")) marks.push("em");
    else if (prop === "text-decoration" || prop === "text-decoration-line") {
      if (v.includes("underline")) marks.push("u");
      if (v.includes("line-through")) marks.push("s");
    } else if (prop === "vertical-align" && (v === "super" || v === "sub")) {
      marks.push(v === "super" ? "sup" : "sub");
    }
  }
  return Array.from(new Set(marks));
}

const isBlankText = (node: Node) => node.nodeType === Node.TEXT_NODE && !(node.textContent ?? "").trim();

function convertNode(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? "")];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP_CONTENT_TAGS.has(tag)) return [];
  if (tag === "br") return [doc.createElement("br")];
  const children = Array.from(el.childNodes)
    .filter((c) => !((tag === "ul" || tag === "ol") && isBlankText(c)))
    .flatMap((c) => convertNode(c, doc));
  let style = el.getAttribute("style") || "";
  if (tag === "font" && el.getAttribute("color")) style = `color: ${el.getAttribute("color")}; ${style}`;
  if (tag === "font" && el.getAttribute("face")) style = `font-family: ${el.getAttribute("face")}; ${style}`;
  let target = TAG_RENAMES[tag] ?? tag;
  if (target === "strong" && /font-weight\s*:\s*(normal|[1-5]00)\b/i.test(style)) target = "span";
  if (target === "sub" || target === "sup" || SCRIPT_STYLE.test(style)) {
    // Sub/superscript already shrink the text; Docs adds its own smaller size.
    style = styleDecls(style)
      .filter(([prop]) => prop !== "font-size")
      .map(([prop, value]) => `${prop}: ${value}`)
      .join("; ");
  }

  const wrappers: Element[] = [];
  const styledSpan = (spanStyle: string) => {
    const span = doc.createElement("span");
    span.setAttribute("style", spanStyle);
    return span;
  };
  if (target === "span") {
    // Highlights are stored as <mark>; colour and font stay on the span inside it.
    const background = cleanStyle("mark", `background-color: ${styleValue(style, "background-color", "background")}`);
    const spanStyle = cleanStyle("span", style);
    if (background) {
      const mark = doc.createElement("mark");
      mark.setAttribute("style", background);
      wrappers.push(mark);
    }
    if (spanStyle) wrappers.push(styledSpan(spanStyle));
  } else if (ALLOWED_TAGS.includes(target) && (target !== "a" || SAFE_HREF.test((el.getAttribute("href") || "").trim()))) {
    const out = doc.createElement(target);
    let cleaned = cleanStyle(target, style);
    if (BLOCK_TAGS.has(target) && !cleaned) cleaned = cleanStyle(target, `text-align: ${el.getAttribute("align") || ""}`);
    if (cleaned) out.setAttribute("style", cleaned);
    const href = el.getAttribute("href");
    if (target === "a" && href) out.setAttribute("href", href.trim());
    const start = el.getAttribute("start") || "";
    if (target === "ol" && /^\d{1,4}$/.test(start)) out.setAttribute("start", start);
    wrappers.push(out);
    const blockFont = cleanStyle(
      "span",
      `font-family: ${styleValue(style, "font-family")}; font-size: ${styleValue(style, "font-size")}`
    );
    if (BLOCK_TAGS.has(target) && blockFont) wrappers.push(styledSpan(blockFont));
  }
  for (const mark of inlineMarksFromStyle(style)) if (mark !== target) wrappers.push(doc.createElement(mark));

  if (wrappers.length === 0) return children;
  wrappers.reduce((parent, child) => (parent.appendChild(child), child));
  const innermost = wrappers[wrappers.length - 1];
  children.forEach((c) => innermost.appendChild(c));
  return [wrappers[0]];
}

/** Rewrite legacy / pasted markup (div, font, inline bold styles, arbitrary colours) into the editor schema. */
export function normalizeRichHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const container = parsed.createElement("div");
  Array.from(parsed.body.childNodes)
    .filter((c) => !(isBlankText(c) && (c.textContent ?? "").includes("\n")))
    .flatMap((c) => convertNode(c, parsed))
    .forEach((c) => container.appendChild(c));
  return container.innerHTML;
}

let purifier: ReturnType<typeof DOMPurify> | null = null;

function getPurifier() {
  if (purifier || typeof window === "undefined") return purifier;
  const instance = DOMPurify(window);
  instance.addHook("uponSanitizeAttribute", (node, data) => {
    const tag = node.nodeName.toLowerCase();
    if (data.attrName === "style") {
      const cleaned = cleanStyle(tag, data.attrValue);
      if (cleaned) data.attrValue = cleaned;
      else data.keepAttr = false;
    } else if (data.attrName === "start") {
      data.keepAttr = tag === "ol" && /^\d{1,4}$/.test(data.attrValue);
    } else if (["href", "target", "rel"].includes(data.attrName)) {
      data.keepAttr = tag === "a";
    }
  });
  instance.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A" && (node as Element).hasAttribute("href")) {
      (node as Element).setAttribute("target", "_blank");
      (node as Element).setAttribute("rel", "noopener noreferrer");
    }
  });
  purifier = instance;
  return purifier;
}

/** Allow-list sanitizer (legacy markup is normalized first, DOMPurify is the final gate). */
export function sanitizeRichHtml(html: string): string {
  const purify = getPurifier();
  if (!purify) return "";
  return purify.sanitize(normalizeRichHtml(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["style", "href", "target", "rel", "start"],
    ALLOWED_URI_REGEXP: SAFE_HREF,
    ADD_URI_SAFE_ATTR: ["start", "target", "rel"],
    KEEP_CONTENT: true,
  }) as string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Legacy plain text → paragraphs (blank lines) and line breaks (single newlines). */
export function plainTextToHtml(text: string): string {
  const normalized = (text || "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";
  return normalized
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Safe HTML for any stored instruction, whether editor HTML, older toolbar HTML or plain text. */
export function instructionToHtml(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  return looksLikeRichHtml(text) ? sanitizeRichHtml(text) : plainTextToHtml(text);
}

const scriptChars = (from: string, to: string) => new Map(Array.from(from).map((c, i) => [c, Array.from(to)[i]]));
const SCRIPT_CHARS: Record<"sub" | "sup", Map<string, string>> = {
  sup: scriptChars("0123456789+-−=()ni", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁿⁱ"),
  sub: scriptChars("0123456789+-−=()aehklmnopstx", "₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎ₐₑₕₖₗₘₙₒₚₛₜₓ"),
};

/** H₂O / cm⁻¹ when every character has a Unicode form, otherwise x^(…) / x_(…); ASCII for fonts without them. */
function scriptText(text: string, kind: "sub" | "sup", ascii: boolean): string {
  if (!text.trim()) return text;
  if (ascii) return kind === "sub" ? text : /^[\w.+-]+$/.test(text) ? `^${text}` : `^(${text})`;
  const chars = SCRIPT_CHARS[kind];
  const all = Array.from(text);
  if (all.every((c) => chars.has(c))) return all.map((c) => chars.get(c)).join("");
  return `${kind === "sup" ? "^" : "_"}(${text})`;
}

/**
 * Plain-text rendering for PDFs and character counts (lists become "•" / "1." lines, like the backend).
 * `ascii` writes sub/superscript as H2O / cm^-1 for PDF fonts that lack the Unicode characters.
 */
export function richTextToPlain(value: string | null | undefined, options: { ascii?: boolean } = {}): string {
  const text = value ?? "";
  if (!looksLikeRichHtml(text) || typeof DOMParser === "undefined") return text.trim();
  const doc = new DOMParser().parseFromString(`<body>${text}</body>`, "text/html");
  const out: string[] = [];
  const lists: { ordered: boolean; n: number }[] = [];
  const newline = () => {
    if (out.length && !out[out.length - 1].endsWith("\n")) out.push("\n");
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName.toLowerCase();
    if (DROP_CONTENT_TAGS.has(tag)) return;
    if (tag === "br") {
      out.push("\n");
      return;
    }
    if (tag === "sub" || tag === "sup") {
      const start = out.length;
      node.childNodes.forEach(walk);
      out.splice(start, out.length - start, scriptText(out.slice(start).join(""), tag, !!options.ascii));
      return;
    }
    const isList = tag === "ul" || tag === "ol";
    const isBlock = /^(p|div|h[1-6]|blockquote)$/.test(tag);
    if (isList) {
      newline();
      const start = Number((node as Element).getAttribute("start") || "1");
      lists.push({ ordered: tag === "ol", n: Number.isFinite(start) ? start - 1 : 0 });
    } else if (tag === "li") {
      newline();
      const list = lists[lists.length - 1];
      let marker = "•";
      if (list?.ordered) {
        list.n += 1;
        marker = `${list.n}.`;
      }
      out.push(`${"  ".repeat(Math.max(0, lists.length - 1))}${marker} `);
    } else if (isBlock && !(lists.length && out[out.length - 1]?.endsWith(" "))) {
      newline();
    }
    node.childNodes.forEach(walk);
    if (isList) {
      lists.pop();
      newline();
    } else if (isBlock || tag === "li") {
      newline();
    }
  };
  doc.body.childNodes.forEach(walk);
  return out
    .join("")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
