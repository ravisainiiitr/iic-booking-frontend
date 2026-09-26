/** Calendar cells show a short label for holidays; the holiday's name is revealed on hover. */
export const HOLIDAY_LABEL = "Holiday";

/** The slots API also lists weekends as holidays, labelled with the weekday name. */
const WEEKEND_LABELS = new Set(["saturday", "sunday"]);

function isWeekendLabel(name: string): boolean {
  return WEEKEND_LABELS.has(name.toLowerCase());
}

export function holidayCellLabel(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed && isWeekendLabel(trimmed) ? trimmed : HOLIDAY_LABEL;
}

export function holidayHoverText(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return HOLIDAY_LABEL;
  return isWeekendLabel(trimmed) ? trimmed : `${HOLIDAY_LABEL}: ${trimmed}`;
}
