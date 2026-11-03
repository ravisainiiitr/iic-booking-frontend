import type { IstemMappingEquipmentRow, IstemSource } from "@/lib/api";

export type InstrumentFilter = "all" | "todo" | "mapped" | "not_found";

export const INSTRUMENT_FILTERS: { value: InstrumentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To map" },
  { value: "mapped", label: "Mapped" },
  { value: "not_found", label: "Not found on I-STEM" },
];

export function isMapped(row: IstemMappingEquipmentRow): boolean {
  return Boolean(row.mapping?.is_active && row.mapping.istem_equipment_id);
}

export function filterInstruments(rows: IstemMappingEquipmentRow[], filter: InstrumentFilter, text = "") {
  const needle = text.trim().toLowerCase();
  return rows.filter((row) => {
    if (needle) {
      const haystack = [row.name, row.code, row.mapping?.istem_equipment_id, row.mapping?.remote_equipment_name]
        .join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    switch (filter) {
      case "todo": return !isMapped(row);
      case "mapped": return isMapped(row);
      case "not_found": return isMapped(row) && row.mapping?.remote_found === false;
      default: return true;
    }
  });
}

/** How sure a suggestion is, in words: the score is 0..1 from the server (serial, model, short name, make, name). */
export function confidence(score: number): { label: string; tone: "strong" | "good" | "weak" } {
  if (score >= 0.9) return { label: "Certain", tone: "strong" };
  if (score >= 0.7) return { label: "Likely", tone: "good" };
  return { label: "Possible", tone: "weak" };
}

const REASONS: Record<string, string> = {
  "serial number": "same serial number",
  model: "same model",
  "short name": "I-STEM short name",
  make: "same make",
  name: "similar name",
};

export function reasonText(reasons: string[]): string {
  return reasons.map((r) => REASONS[r] ?? r).join(", ");
}

export function readAt(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** One line about where I-STEM's list came from: live, or the last good read while I-STEM is not answering. */
export function sourceNote(source?: IstemSource | null): string {
  if (!source) return "";
  if (source.live) return "";
  const when = readAt(source.read_at);
  return `${source.problem || "I-STEM is not answering."} Showing I-STEM's list as read${when ? ` on ${when}` : " earlier"}.`;
}
