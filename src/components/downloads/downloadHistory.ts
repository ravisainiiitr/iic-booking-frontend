import type { DownloadHistoryEntry } from "./types";

const STORAGE_KEY = "iitr.secureDownload.history.v1";
const MAX_ENTRIES = 20;

export function loadDownloadHistory(productKey?: string): DownloadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as DownloadHistoryEntry[];
    if (!Array.isArray(rows)) return [];
    return productKey ? rows.filter((r) => r.productKey === productKey) : rows;
  } catch {
    return [];
  }
}

export function pushDownloadHistory(entry: Omit<DownloadHistoryEntry, "id">): DownloadHistoryEntry[] {
  const next: DownloadHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const existing = loadDownloadHistory();
  const merged = [next, ...existing].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* quota / private mode — ignore */
  }
  return productFilter(merged, entry.productKey);
}

function productFilter(rows: DownloadHistoryEntry[], productKey: string) {
  return rows.filter((r) => r.productKey === productKey);
}
