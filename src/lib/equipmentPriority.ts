/**
 * The user's saved equipment priority applied to a list: saved ids that are still in the list come first
 * (in saved order), the rest keep their current order at the end. Ids no longer in the list are ignored.
 */
export function orderByPriority<T>(items: readonly T[], idOf: (item: T) => number, priority: readonly number[]): T[] {
  if (priority.length === 0 || items.length < 2) return [...items];
  const rank = new Map<number, number>();
  priority.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, index);
  });
  return items
    .map((item, index) => ({ item, index, rank: rank.get(idOf(item)) }))
    .sort((a, b) => {
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      if (a.rank != null) return -1;
      if (b.rank != null) return 1;
      return a.index - b.index;
    })
    .map((row) => row.item);
}

/** Moves the element at `from` to `to` (both clamped); returns a new array. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}
