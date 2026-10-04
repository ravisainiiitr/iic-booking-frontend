/** Per-user record of What's New items already shown, for the unread highlight (this browser only). */

const MAX_REMEMBERED = 300;

function key(userId: number) {
  return `iic_whats_new_seen_${userId}`;
}

function read(userId: number): string[] | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

/** Items not shown to this user before; on a first visit every item counts as unread. */
export function unreadWhatsNewIds(userId: number | null | undefined, itemIds: string[]): Set<string> {
  if (userId == null) return new Set();
  const seen = read(userId);
  if (!seen) return new Set(itemIds);
  const known = new Set(seen);
  return new Set(itemIds.filter((id) => !known.has(id)));
}

export function markWhatsNewSeen(userId: number | null | undefined, itemIds: string[]) {
  if (userId == null || itemIds.length === 0) return;
  const merged = Array.from(new Set([...itemIds, ...(read(userId) ?? [])])).slice(0, MAX_REMEMBERED);
  try {
    localStorage.setItem(key(userId), JSON.stringify(merged));
  } catch {
    /* ignore quota / private mode */
  }
}
