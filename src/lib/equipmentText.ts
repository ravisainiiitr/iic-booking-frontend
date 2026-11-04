/**
 * Turns the plain text staff type into equipment descriptions and specification values into simple structure,
 * without changing any wording:
 *   "1) Acceleration Voltage 200 kV" / "- item" / "• item"  -> list items
 *   "Make- THERMOFISHER" / "Year of Installation: 2024"     -> label / value rows (short labels only)
 *   "Applications:"                                          -> a subheading
 *   anything else                                            -> paragraphs (blank lines separate them)
 */
export type TextBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "pairs"; rows: Array<{ label: string; value: string }> };

const LIST_ITEM = /^\s*(?:\(?\d{1,3}[.)]|[-•*▪●–])\s+(.+)$/;
const PAIR = /^([A-Za-z][A-Za-z0-9 ()/&.'+]{0,38}?)\s*(?:[:：]|\s?[-–])\s*(\S.*)$/;
const HEADING = /^([^:]{2,60}):\s*$/;

function asPair(line: string): { label: string; value: string } | null {
  const m = PAIR.exec(line);
  if (!m) return null;
  const label = m[1].trim();
  if (!label || label.split(/\s+/).length > 5 || /\d{3,}/.test(label)) return null;
  return { label, value: m[2].trim() };
}

export function parseEquipmentText(raw: string | null | undefined): TextBlock[] {
  const lines = String(raw ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: TextBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", text: para.join(" ") });
    para = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === "list") last.items.push(item[1].trim());
      else blocks.push({ type: "list", items: [item[1].trim()] });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1].trim() });
      continue;
    }
    const pair = para.length === 0 ? asPair(line) : null;
    if (pair) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "pairs") last.rows.push(pair);
      else blocks.push({ type: "pairs", rows: [pair] });
      continue;
    }
    para.push(line);
  }
  flush();
  // Rows of one are just sentences that happen to contain a colon or dash.
  return blocks.map((b) =>
    b.type === "pairs" && b.rows.length === 1 ? { type: "paragraph", text: `${b.rows[0].label}: ${b.rows[0].value}` } : b,
  );
}

/** Visible length, to decide when to fold a long section behind "Show more". */
export function textLength(raw: string | null | undefined): number {
  return String(raw ?? "").replace(/\s+/g, " ").trim().length;
}

/** "General Information:" -> "General Information". */
export function cleanLabel(label: string): string {
  return label.trim().replace(/[\s:：-]+$/, "");
}

/** Digits and a leading + only, for tel: links; "" when nothing dialable remains. */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned.replace(/\D/g, "").length >= 5 ? `tel:${cleaned}` : "";
}

export function isEmail(value: string): boolean {
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value);
}

export function initials(name: string): string {
  const parts = name.replace(/^(?:prof|dr|mr|mrs|ms|shri|smt)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Photo URLs come from the API host; keep them on https when the page is https (no mixed content). */
export function safePhotoUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (/^https:\/\//i.test(url)) return url;
  if (/^http:\/\//i.test(url) && typeof window !== "undefined" && window.location.protocol === "https:") {
    return url.replace(/^http:/i, "https:");
  }
  return /^http:\/\//i.test(url) ? url : "";
}
