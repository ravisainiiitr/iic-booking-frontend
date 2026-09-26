/** Calendar cells show a short label for holidays; the holiday's name is revealed on hover. */
export const HOLIDAY_LABEL = "Holiday";

export function holidayHoverText(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? `${HOLIDAY_LABEL}: ${trimmed}` : HOLIDAY_LABEL;
}
