const ALLOWED_TAGS = new Set([
  "P", "DIV", "SPAN", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "FONT", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE",
]);
const ALLOWED_STYLE_PROPS = new Set([
  "color", "background-color", "font-family", "font-size", "font-weight",
  "font-style", "text-decoration", "text-decoration-line", "text-align",
]);
const SAFE_STYLE_VALUE = /^[#(),.%\-\w\s'"]+$/;
const HTML_TAG = /<\/?(p|div|span|br|b|strong|i|em|u|s|strike|font|ul|ol|li|h[1-4]|blockquote)\b/i;

export function looksLikeRichHtml(value: string | null | undefined): boolean {
  return !!value && HTML_TAG.test(value);
}

function cleanStyle(raw: string): string {
  return raw
    .split(";")
    .map((decl) => {
      const idx = decl.indexOf(":");
      if (idx < 0) return "";
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      const lowered = value.toLowerCase();
      if (!ALLOWED_STYLE_PROPS.has(prop) || !value || value.length > 80) return "";
      if (lowered.includes("url(") || lowered.includes("expression") || lowered.includes("javascript")) return "";
      if (!SAFE_STYLE_VALUE.test(value)) return "";
      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

function sanitizeNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return null;
  const children = Array.from(el.childNodes)
    .map((c) => sanitizeNode(c, doc))
    .filter((c): c is Node => c !== null);
  if (!ALLOWED_TAGS.has(el.tagName)) {
    const frag = doc.createDocumentFragment();
    children.forEach((c) => frag.appendChild(c));
    return frag;
  }
  const out = doc.createElement(el.tagName.toLowerCase());
  const style = cleanStyle(el.getAttribute("style") || "");
  if (style) out.setAttribute("style", style);
  if (el.tagName === "FONT") {
    const color = el.getAttribute("color") || "";
    const face = el.getAttribute("face") || "";
    const size = el.getAttribute("size") || "";
    if (color && SAFE_STYLE_VALUE.test(color) && color.length <= 30) out.setAttribute("color", color);
    if (face && SAFE_STYLE_VALUE.test(face) && face.length <= 80) out.setAttribute("face", face);
    if (/^[1-7]$/.test(size)) out.setAttribute("size", size);
  }
  children.forEach((c) => out.appendChild(c));
  return out;
}

/** Allow-list sanitizer mirroring the backend (`equipment/rich_text.py`). */
export function sanitizeRichHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";
  const container = parsed.createElement("div");
  Array.from(root.childNodes).forEach((c) => {
    const clean = sanitizeNode(c, parsed);
    if (clean) container.appendChild(clean);
  });
  return container.innerHTML;
}

export function richTextToPlain(value: string | null | undefined): string {
  const text = value ?? "";
  if (!looksLikeRichHtml(text)) return text.trim();
  const withBreaks = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-4]|blockquote)>/gi, "\n");
  if (typeof DOMParser === "undefined") return withBreaks.replace(/<[^>]+>/g, "").trim();
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}
