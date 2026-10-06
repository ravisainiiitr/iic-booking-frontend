/**
 * Dates are shown and typed as DD-MM-YYYY everywhere, whatever the browser locale. The API keeps
 * ISO dates (YYYY-MM-DD); these helpers convert between the two without touching time zones.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY = /^\s*(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})\s*$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || y < 1000) return false;
  return d <= new Date(y, m, 0).getDate();
}

/** Local calendar date of a Date as YYYY-MM-DD. */
export function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local Date (midnight) for a YYYY-MM-DD string, or null. */
export function dateFromIso(iso: string | null | undefined): Date | null {
  const m = ISO_DATE.exec(iso ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return validYmd(y, mo, d) ? new Date(y, mo - 1, d) : null;
}

/**
 * DD-MM-YYYY for an ISO date ("2026-10-06" or "2026-10-06T…" → "06-10-2026") or a Date.
 * Datetime strings with a zone are converted to the local date. Empty or invalid input gives "".
 */
export function formatDMY(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : formatDMY(isoFromDate(value));
  const s = String(value);
  if (/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "" : formatDMY(isoFromDate(d));
  }
  const m = ISO_DATE.exec(s);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** DD-MM-YYYY HH:mm (24 h, local time) for a datetime, or "" when empty/invalid. */
export function formatDMYTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDMY(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO date for typed text: DD-MM-YYYY (also / . or space separators) or YYYY-MM-DD. Null if not a real date. */
export function parseDMY(text: string | null | undefined): string | null {
  const s = (text ?? "").trim();
  if (!s) return null;
  const dmy = DMY.exec(s);
  if (dmy) {
    const [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    return validYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dateFromIso(s) ? s : null;
  return null;
}

/** Auto-insert dashes while typing digits: "0610" → "06-10", "06102026" → "06-10-2026". */
export function maskDMY(text: string): string {
  if (/^\d{3,8}$/.test(text)) {
    if (text.length <= 4) return `${text.slice(0, 2)}-${text.slice(2)}`;
    return `${text.slice(0, 2)}-${text.slice(2, 4)}-${text.slice(4)}`;
  }
  const dayFirst = /^(\d{2})-(\d{3,6})$/.exec(text);
  if (dayFirst) return `${dayFirst[1]}-${dayFirst[2].slice(0, 2)}-${dayFirst[2].slice(2)}`;
  return text;
}
