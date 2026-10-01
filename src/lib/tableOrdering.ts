/** Parse a DRF-style ordering string ("start_time" / "-start_time") into key + direction. */
export function parseOrdering(ordering: string | null | undefined): { key: string; desc: boolean } {
  const raw = (ordering || "").trim();
  if (raw.startsWith("-")) return { key: raw.slice(1), desc: true };
  return { key: raw, desc: false };
}

/** Next ordering when a column header is clicked: a new column starts ascending, the active one toggles. */
export function nextOrdering(current: string | null | undefined, key: string): string {
  const { key: activeKey, desc } = parseOrdering(current);
  if (activeKey !== key) return key;
  return desc ? key : `-${key}`;
}
