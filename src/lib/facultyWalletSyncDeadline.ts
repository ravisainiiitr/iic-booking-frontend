// India has no daylight saving, so IST is always UTC+05:30.
const IST_OFFSET = "+05:30";
const IST_TIME_ZONE = "Asia/Kolkata";

/** "31 Oct 2026, 11:59:59 pm IST" for an ISO timestamp, or "—". */
export function formatIst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const text = d.toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${text} IST`;
}

/** Value for <input type="datetime-local" step="1"> showing the instant in IST. */
export function istInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + (5 * 60 + 30) * 60 * 1000);
  return shifted.toISOString().slice(0, 19);
}

/** Converts a datetime-local value entered as IST to an ISO string with the +05:30 offset. */
export function istInputToIso(value: string): string | null {
  // Inputs may normalise to HH:mm (zero seconds) or HH:mm:ss.SSS; fractions are dropped.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(value.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}${IST_OFFSET}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return istInputValue(d.toISOString()) === iso.slice(0, 19) ? iso : null;
}
