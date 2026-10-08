import { useCallback, useState } from "react";

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100, 500] as const;

export type RowsPerPageScope = "view-booking" | "my-bookings" | "wallet-owners" | "wallet-transactions";

export function rowsPerPageStorageKey(scope: RowsPerPageScope, userId: string | number): string {
  return `iic.rowsPerPage.${scope}.${userId}`;
}

/** One of the offered sizes, else `fallback`. */
export function normalizeRowsPerPage(value: unknown, fallback: number): number {
  const n = Number(value);
  return (ROWS_PER_PAGE_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

function readStored(key: string | null, fallback: number): number {
  if (!key) return fallback;
  try {
    return normalizeRowsPerPage(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

/**
 * Rows per page of a booking list, remembered per user in localStorage. The stored size is read during
 * render, so the first request after sign-in already uses it; before the user is known it is `fallback`.
 */
export function useRowsPerPage(
  scope: RowsPerPageScope,
  userId: string | number | null | undefined,
  fallback: number,
): [number, (next: number) => void] {
  const key = userId == null || userId === "" ? null : rowsPerPageStorageKey(scope, userId);
  const [chosen, setChosen] = useState<{ key: string | null; size: number } | null>(null);
  const size = chosen && chosen.key === key ? chosen.size : readStored(key, fallback);

  const setSize = useCallback(
    (next: number) => {
      const value = normalizeRowsPerPage(next, fallback);
      setChosen({ key, size: value });
      if (!key) return;
      try {
        window.localStorage.setItem(key, String(value));
      } catch {
        // Storage full or blocked: the choice still applies until the page is reloaded.
      }
    },
    [key, fallback],
  );

  return [size, setSize];
}
